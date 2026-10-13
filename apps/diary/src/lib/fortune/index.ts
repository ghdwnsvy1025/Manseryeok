// 오늘의 운세 — 계산, 문장, 캐시를 한 곳에서.
// 1) 사용자(또는 게스트 지문) × 날짜 캐시가 있으면 그대로 준다.
// 2) 없으면 코어 판정(v4: core.ts) → 10점 환산 → 내 기록 보정 → 글(3단계 llm.ts: 모델 → 검사 → 재작성 1회 → 템플릿) → 캐시에 쓴다.
// v3의 computeBaseFortune(base.ts)은 더 쓰지 않는다 (백테스트·테스트가 참조하므로 파일은 둔다).
import { visibleAreas } from "./visible";
import { recentFromRows, type RecentFortune } from "./brief";
import "server-only";
import { createHash } from "node:crypto";
import { ENGINE_VERSION } from "@saju/engine";
import { adminClient } from "../supabase/admin";
import { ownerFilter, saveFortuneCache, type FortuneCacheDb, type FortuneCacheRow } from "./cache";
import { dayGanji } from "../ganji";
import type { BirthProfile, PillarsSnapshot } from "../profile";
import { addDays, parseYmd } from "../time";
import { computeCoreFortune } from "./core";
import { generateFortuneText } from "./llm";
import { adjustWithEntries, bandOf, fitPercent, toTenPoint, type EntryLike } from "./personal";
import { templateInputFromCore, templateText } from "./text";
import type { FortuneContent } from "./types";
import { dailyCap, regenPolicy, retryAfterFor, usableCachedContent } from "./policy";
export { REGEN_LIMIT, TRANSIENT_RETRY_MS, dailyCap, regenCountOf, regenPolicy, retryAfterFor, usableCachedContent } from "./policy";

/** 캐시 지문에 들어간다. 올리면 기존 캐시가 전부 무효 */
export const FORTUNE_VERSION = "v4.11";

export type FortuneOwner = { userId: string; guestKey?: undefined } | { guestKey: string; userId?: undefined };

/** 캐시 행에서 판정에 필요한 열만. 화면이 첫 Promise.all에서 미리 읽어 넘길 수 있다 */
export interface FortuneCacheLookup {
  id: string;
  profile_fingerprint: string;
  content: unknown;
}

export interface FortuneRequest {
  date: string;
  pillars: PillarsSnapshot;
  /** 생년월일시·성별·달력·도시. 대운 목록(fromBirth)에 쓴다. 게스트도 쿠키에 같은 필드가 있다 */
  profile: BirthProfile | null;
  /** 기록 전체. 게스트는 빈 배열 */
  entries: EntryLike[];
  owner: FortuneOwner;
  /**
   * 화면이 이미 읽어 둔 캐시 행. `undefined`면 여기서 조회하고, `null`이면 "없음"이 확정된 것, 행이면 그 행을 쓴다
   * (오늘 화면은 사용자 조회와 같은 단계에서 캐시를 읽어 두므로 두 번 묻지 않는다 — 전수조사 A-2)
   */
  cached?: FortuneCacheLookup | null;
}

/** 읽어 둔 캐시 행이 지금 원국·출생 입력에 맞으면 그 내용. 아니면 null (다시 계산해야 한다) */
export function cachedFortuneContent(row: FortuneCacheLookup | null, pillars: PillarsSnapshot, profile: BirthProfile | null): FortuneContent | null {
  if (!row || row.profile_fingerprint !== fingerprint(pillars, profile)) return null;
  return usableCachedContent(row.content);
}

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/** 버전·엔진·원국·출생 입력이 하나라도 다르면 다른 지문 → v3 캐시는 v4에서 자동으로 다시 계산된다 */
export function fingerprint(pillars: PillarsSnapshot, profile: BirthProfile | null): string {
  const birth = profile
    ? [profile.gender, profile.calendar, profile.isLeapMonth, profile.birthYear, profile.birthMonth, profile.birthDay, profile.birthHour, profile.birthMinute, profile.city]
    : null;
  return createHash("sha256")
    .update(JSON.stringify([FORTUNE_VERSION, ENGINE_VERSION, pillars, birth]))
    .digest("hex")
    .slice(0, 24);
}

// 같은 사람·같은 날 계산이 동시에 들어오면(첫 화면이 두 번 렌더될 때) 모델을 두 번 부르지 않게 진행 중인 약속을 나눠 쓴다
const inFlight = new Map<string, Promise<FortuneContent>>();

export function getTodayFortune(req: FortuneRequest): Promise<FortuneContent> {
  const { col, val } = ownerFilter(req.owner);
  const key = `${col}:${val}:${req.date}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = getTodayFortuneUncached(req).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function getTodayFortuneUncached(req: FortuneRequest): Promise<FortuneContent> {
  const sb = adminClient();
  const fp = fingerprint(req.pillars, req.profile);
  const { col, val } = ownerFilter(req.owner);

  let cached: FortuneCacheLookup | null;
  if (req.cached === undefined) {
    const { data } = await sb
      .from("night_fortunes")
      .select("id, profile_fingerprint, content")
      .eq(col, val)
      .eq("fortune_date", req.date)
      .maybeSingle();
    cached = (data as FortuneCacheLookup | null) ?? null;
  } else {
    cached = req.cached;
  }
  if (cached && cached.profile_fingerprint === fp) {
    const usable = usableCachedContent(cached.content);
    if (usable) return usable;
    // API 장애 템플릿의 재시도 시각이 지났다 → 아래에서 다시 만든다 (지문은 같으니 regen으로 세지 않는다)
  }
  const regenerating = Boolean(cached && cached.profile_fingerprint !== fp);

  // v4.8 기억(2층): 최근 3일 이 사람의 운세 헤드라인·첫 두 문장. 모델이 같은 말을 되풀이하지 않게 (없거나 실패하면 빈 배열)
  let recent: RecentFortune[] = [];
  try {
    const { data } = await sb
      .from("night_fortunes")
      .select("fortune_date, content")
      .eq(col, val)
      .gte("fortune_date", addDays(req.date, -3))
      .lt("fortune_date", req.date)
      .order("fortune_date", { ascending: false })
      .limit(3);
    recent = recentFromRows((data ?? []) as { fortune_date: string; content: { headline?: string; body?: string } | null }[]);
    // v4.9: 그날 누른 "맞아요/아니에요"를 붙인다 (로그인 사용자만)
    if (recent.length && req.owner.userId) {
      const { data: votes } = await sb
        .from("night_fortune_feedback")
        .select("fortune_date, vote")
        .eq("user_id", req.owner.userId)
        .in("fortune_date", recent.map((r) => r.date));
      const byDate = new Map(((votes ?? []) as { fortune_date: string; vote: number }[]).map((v) => [v.fortune_date, v.vote]));
      recent = recent.map((r) => {
        const v = byDate.get(r.date);
        return v === 1 || v === -1 ? { ...r, vote: v } : r;
      });
    }
  } catch (e) {
    console.warn("최근 운세 읽기 실패", e instanceof Error ? e.message : e);
  }

  // 비용 상한: 같은 날 재생성 횟수와 하루 전체 모델 호출 수 (B-H1)
  const { regen, useModel: regenOk } = regenPolicy(regenerating ? cached : null);
  let useModel = Boolean(process.env.ANTHROPIC_API_KEY) && regenOk;
  if (!regenOk) console.warn(`[fortune] 같은 날 재생성 ${regen}회째 — 모델 없이 템플릿 (${col}=${val})`);
  if (useModel) {
    try {
      const { count } = await sb.from("night_fortunes").select("id", { count: "exact", head: true }).eq("fortune_date", req.date).not("model", "is", null);
      if ((count ?? 0) >= dailyCap()) {
        useModel = false;
        console.warn(`[fortune] 오늘 모델 호출 ${count}건 — 일일 상한 ${dailyCap()} 도달, 템플릿만`);
      }
    } catch (e) {
      console.warn("일일 상한 조회 실패(모델은 그대로 씀)", e instanceof Error ? e.message : e);
    }
  }

  const computed = await computeFortune({ ...req, recent }, { useModel });
  const content: FortuneContent = regen > 0 ? { ...computed, regen } : computed;

  // API 장애 템플릿은 retryAfter(10분)까지만 쓰는 짧은 캐시로 — 장애 중 화면을 열 때마다 모델을 부르지 않게 (A-3)
  const toCache: FortuneContent = content.transient === "api" ? { ...content, retryAfter: retryAfterFor() } : content;
  if (content.transient === "api") console.warn(`[fortune] API 장애로 템플릿 — ${toCache.retryAfter}까지 짧게 캐시 (${col}=${val} ${req.date})`);

  const row: FortuneCacheRow = {
    user_id: req.owner.userId ?? null,
    guest_key: req.owner.guestKey ?? null,
    fortune_date: req.date,
    profile_fingerprint: fp,
    score: content.score,
    content: toCache,
    model: content.source === "llm" ? content.model ?? null : null,
    tokens_in: content.usage ? content.usage.input + content.usage.cacheRead + content.usage.cacheWrite : null,
    tokens_out: content.usage ? content.usage.output : null,
  };
  // 지문만 달라진 기존 행은 update. 없으면 insert — 동시 요청으로 중복 키가 나면 cache.ts가 그 행을 찾아 update한다
  const { path, error } = await saveFortuneCache(sb as unknown as FortuneCacheDb, req.owner, row, cached?.id ?? null);
  if (error) console.error(`운세 캐시 저장 실패 (${path})`, error);
  return content;
}

/** 캐시 없이 계산만. 테스트와 미리보기용 */
export async function computeFortune(req: Omit<FortuneRequest, "owner"> & { recent?: RecentFortune[] }, opts: { useModel?: boolean } = {}): Promise<FortuneContent> {
  const p = parseYmd(req.date);
  if (!p) throw new Error(`잘못된 날짜: ${req.date}`);
  const today = dayGanji(req.date);

  const core = computeCoreFortune({ pillars: req.pillars, profile: req.profile, date: req.date, todayHanja: today.hanja });
  const personal = adjustWithEntries(core.parts.score01, req.entries, { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
  const score10 = toTenPoint(personal.score);
  const todayInfo = { ko: today.ko, hanja: today.hanja, stemKo: today.stemKo, branchKo: today.branchKo };
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]!;

  const tmplInput = templateInputFromCore(core);
  const fallback = templateText(tmplInput, personal, todayInfo);
  const band = bandOf(score10);
  let text = fallback;
  let source: FortuneContent["source"] = "template";
  let attempts = 0;
  let model: string | undefined;
  let usage: FortuneContent["usage"];
  let transient: FortuneContent["transient"];
  const useModel = opts.useModel ?? Boolean(process.env.ANTHROPIC_API_KEY);
  if (useModel) {
    try {
      const r = await generateFortuneText({ core, personal, today: todayInfo, date: req.date, weekday, score10, band, recent: req.recent ?? [] }, fallback);
      text = r.text;
      source = r.source;
      attempts = r.attempts;
      if (r.model) model = r.model;
      if (r.attempts > 0) usage = r.usage;
      transient = r.transient;
    } catch (e) {
      console.warn("운세 글 생성 실패, 템플릿 사용:", e instanceof Error ? e.message : e);
      transient = "api";
    }
  }

  return {
    version: "v4",
    date: req.date,
    dayGanjiKo: today.ko,
    dayGanjiHanja: today.hanja,
    score: score10,
    band,
    headline: text.headline,
    body: text.body,
    do: text.do,
    dont: text.dont,
    ...(text.areas ? { areas: visibleAreas(text.areas, core.facts) } : {}),
    source,
    attempts,
    ...(model ? { model } : {}),
    ...(usage ? { usage } : {}),
    ...(transient ? { transient } : {}),
    core,
    personal,
    fitPercent: fitPercent(req.entries.length),
    ...(tmplInput.fitNote ? { fitNote: tmplInput.fitNote } : {}),
    generatedAt: new Date().toISOString(),
  };
}
