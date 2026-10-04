// 오늘의 운세 — 계산, 문장, 캐시를 한 곳에서.
// 1) 사용자(또는 게스트 지문) × 날짜 캐시가 있으면 그대로 준다.
// 2) 없으면 엔진 기본 점수 → 내 기록 보정 → 모델 1회(실패하면 템플릿) → 캐시에 쓴다.
import "server-only";
import { createHash } from "node:crypto";
import { ENGINE_VERSION } from "@saju/engine";
import { adminClient } from "../supabase/admin";
import { dayGanji } from "../ganji";
import type { PillarsSnapshot } from "../profile";
import { parseYmd } from "../time";
import { computeBaseFortune } from "./base";
import { generateWithModel } from "./llm";
import { adjustWithEntries, bandOf, fitPercent, toTenPoint, type EntryLike } from "./personal";
import { findBanned, templateText } from "./text";
import type { FortuneContent } from "./types";

export const FORTUNE_VERSION = "v3";

export type FortuneOwner = { userId: string; guestKey?: undefined } | { guestKey: string; userId?: undefined };

export interface FortuneRequest {
  date: string;
  pillars: PillarsSnapshot;
  /** 기록 전체. 게스트는 빈 배열 */
  entries: EntryLike[];
  owner: FortuneOwner;
}

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function fingerprint(pillars: PillarsSnapshot): string {
  return createHash("sha256")
    .update(JSON.stringify([FORTUNE_VERSION, ENGINE_VERSION, pillars]))
    .digest("hex")
    .slice(0, 24);
}

function ownerFilter(owner: FortuneOwner) {
  return owner.userId ? { col: "user_id", val: owner.userId } : { col: "guest_key", val: owner.guestKey! };
}

export async function getTodayFortune(req: FortuneRequest): Promise<FortuneContent> {
  const sb = adminClient();
  const fp = fingerprint(req.pillars);
  const { col, val } = ownerFilter(req.owner);

  const { data: cached } = await sb
    .from("night_fortunes")
    .select("id, profile_fingerprint, content")
    .eq(col, val)
    .eq("fortune_date", req.date)
    .maybeSingle();
  if (cached && cached.profile_fingerprint === fp) return cached.content as FortuneContent;

  const content = await computeFortune(req);

  const row = {
    user_id: req.owner.userId ?? null,
    guest_key: req.owner.guestKey ?? null,
    fortune_date: req.date,
    profile_fingerprint: fp,
    score: content.score,
    content,
    model: content.source === "llm" ? process.env.OPENAI_FORTUNE_MODEL ?? "gpt-4o-mini" : null,
  };
  const write = cached
    ? sb.from("night_fortunes").update(row).eq("id", cached.id)
    : sb.from("night_fortunes").insert(row);
  const { error } = await write;
  if (error) console.error("운세 캐시 저장 실패", error.message);
  return content;
}

/** 캐시 없이 계산만. 테스트와 미리보기용 */
export async function computeFortune(req: Omit<FortuneRequest, "owner">, opts: { useModel?: boolean } = {}): Promise<FortuneContent> {
  const p = parseYmd(req.date);
  if (!p) throw new Error(`잘못된 날짜: ${req.date}`);
  const today = dayGanji(req.date);
  const todayHanja = { stem: today.hanja[0]!, branch: today.hanja[1]!, ko: today.ko };

  const base = computeBaseFortune(req.pillars, todayHanja);
  const personal = adjustWithEntries(base.score, req.entries, { index: today.index, stemKo: today.stemKo, branchKo: today.branchKo });
  const score10 = toTenPoint(personal.score);
  const todayInfo = { ko: today.ko, hanja: today.hanja, stemKo: today.stemKo, branchKo: today.branchKo };
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]!;

  let text = templateText(base, personal, todayInfo);
  let source: FortuneContent["source"] = "template";
  const useModel = opts.useModel ?? Boolean(process.env.OPENAI_API_KEY);
  if (useModel) {
    try {
      const generated = await generateWithModel({ base, personal, today: todayInfo, weekday, score10 });
      const banned = findBanned([generated.headline, generated.body, generated.do, generated.dont].join(" "));
      if (banned.length === 0) {
        text = generated;
        source = "llm";
      } else {
        console.warn("운세 문장에 금지어가 있어 템플릿으로 대체", banned);
      }
    } catch (e) {
      console.warn("운세 모델 호출 실패, 템플릿 사용:", e instanceof Error ? e.message : e);
    }
  }

  return {
    version: "v3",
    date: req.date,
    dayGanjiKo: today.ko,
    dayGanjiHanja: today.hanja,
    score: score10,
    band: bandOf(score10),
    headline: text.headline,
    body: text.body,
    do: text.do,
    dont: text.dont,
    source,
    base,
    personal,
    fitPercent: fitPercent(req.entries.length),
    generatedAt: new Date().toISOString(),
  };
}
