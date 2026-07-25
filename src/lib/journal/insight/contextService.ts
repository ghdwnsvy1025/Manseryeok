/**
 * DailyInsight 서비스 경계 — 점수/컨텍스트 저장과 LLM 문장 생성 분리
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDailyInsightContext } from "./buildContext";
import {
  loadOrBuildDailyInsightContext,
  persistDailyInsightContext,
  persistDailyQuestion,
  persistFortune,
  updateFortuneWording,
  type LoadedInsightContext,
} from "./persist";
import { scoreFortuneDomains } from "@/lib/journal/fortune/score";
import type { DailyInsightContext, FortuneDomainResult } from "./types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import type { SajuProfile } from "@/lib/diary/types";
import type { KeywordBiasMap } from "@/lib/journal/keywords/learning";

export {
  loadOrBuildDailyInsightContext,
  persistDailyInsightContext,
  persistDailyQuestion,
  persistFortune,
  updateFortuneWording,
};

export type BuildInsightOpts = {
  eventDate: string;
  entries: JournalEntry[];
  enabledCodes: CategoryCode[];
  sajuProfile?: SajuProfile | null;
  keywordBiases?: KeywordBiasMap;
  timezone?: string;
};

export async function resolveDailyInsightContext(
  sb: SupabaseClient,
  userId: string,
  buildOpts: BuildInsightOpts
): Promise<LoadedInsightContext | null> {
  return loadOrBuildDailyInsightContext(sb, {
    userId,
    eventDate: buildOpts.eventDate,
    build: () => buildDailyInsightContext(buildOpts),
  });
}

export function scoreDailyFortune(
  ctx: DailyInsightContext
): FortuneDomainResult[] {
  return scoreFortuneDomains(ctx);
}
