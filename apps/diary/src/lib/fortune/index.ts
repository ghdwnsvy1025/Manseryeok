// 오늘의 운세 — 계산, 문장, 캐시를 한 곳에서.
// 1) 사용자(또는 게스트 지문) × 날짜 캐시가 있으면 그대로 준다.
// 2) 없으면 코어 판정(v4: core.ts) → 10점 환산 → 내 기록 보정 → 글(3단계 llm.ts: 모델 → 검사 → 재작성 1회 → 템플릿) → 캐시에 쓴다.
// v3의 computeBaseFortune(base.ts)은 더 쓰지 않는다 (백테스트·테스트가 참조하므로 파일은 둔다).
import "server-only";
import { createHash } from "node:crypto";
import { ENGINE_VERSION } from "@saju/engine";
import { adminClient } from "../supabase/admin";
import { ownerFilter, saveFortuneCache, type FortuneCacheDb, type FortuneCacheRow } from "./cache";
import { dayGanji } from "../ganji";
import type { BirthProfile, PillarsSnapshot } from "../profile";
import { parseYmd } from "../time";
import { computeCoreFortune } from "./core";
import { generateFortuneText } from "./llm";
import { adjustWithEntries, bandOf, fitPercent, toTenPoint, type EntryLike } from "./personal";
import { templateInputFromCore, templateText } from "./text";
import type { FortuneContent } from "./types";

/** 캐시 지문에 들어간다. 올리면 기존 캐시가 전부 무효 */
export const FORTUNE_VERSION = "v4.4";

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
  return row.content as FortuneContent;
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
  if (cached && cached.profile_fingerprint === fp) return cached.content as FortuneContent;

  const content = await computeFortune(req);

  const row: FortuneCacheRow = {
    user_id: req.owner.userId ?? null,
    guest_key: req.owner.guestKey ?? null,
    fortune_date: req.date,
    profile_fingerprint: fp,
    score: content.score,
    content,
    model: content.source === "llm" ? content.model ?? null : null,
  };
  // 지문만 달라진 기존 행은 update. 없으면 insert — 동시 요청으로 중복 키가 나면 cache.ts가 그 행을 찾아 update한다
  const { path, error } = await saveFortuneCache(sb as unknown as FortuneCacheDb, req.owner, row, cached?.id ?? null);
  if (error) console.error(`운세 캐시 저장 실패 (${path})`, error);
  return content;
}

/** 캐시 없이 계산만. 테스트와 미리보기용 */
export async function computeFortune(req: Omit<FortuneRequest, "owner">, opts: { useModel?: boolean } = {}): Promise<FortuneContent> {
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
  const useModel = opts.useModel ?? Boolean(process.env.ANTHROPIC_API_KEY);
  if (useModel) {
    try {
      const r = await generateFortuneText({ core, personal, today: todayInfo, date: req.date, weekday, score10, band }, fallback);
      text = r.text;
      source = r.source;
      attempts = r.attempts;
      if (r.model) model = r.model;
    } catch (e) {
      console.warn("운세 글 생성 실패, 템플릿 사용:", e instanceof Error ? e.message : e);
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
    ...(text.areas ? { areas: text.areas } : {}),
    source,
    attempts,
    ...(model ? { model } : {}),
    core,
    personal,
    fitPercent: fitPercent(req.entries.length),
    ...(tmplInput.fitNote ? { fitNote: tmplInput.fitNote } : {}),
    generatedAt: new Date().toISOString(),
  };
}
