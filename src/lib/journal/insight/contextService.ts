/**
 * DailyInsight 서비스 경계 — 점수/컨텍스트 저장과 LLM 문장 생성 분리
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveSajuProfileId } from "@/lib/diary/activeSajuProfile";
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
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";

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
  /** Explicit profile id; falls back to sajuProfile.id then resolveActiveSajuProfileId */
  sajuProfileId?: string | null;
  keywordBiases?: KeywordBiasMap;
  timezone?: string;
};

/** 캐시된 컨텍스트에 natalDay가 없으면 런타임에 붙여 준다 (엔진 업그레이드 호환). */
function hydrateNatalDay(
  ctx: DailyInsightContext,
  sajuProfile?: SajuProfile | null
): DailyInsightContext {
  if (ctx.natalDay) return ctx;
  const natalDay = buildNatalDayInsight(ctx.eventDate, sajuProfile ?? null);
  if (!natalDay) return { ...ctx, natalDay: null };
  return { ...ctx, natalDay };
}

export async function resolveDailyInsightContext(
  sb: SupabaseClient,
  userId: string,
  buildOpts: BuildInsightOpts
): Promise<LoadedInsightContext | null> {
  const sajuProfileId =
    buildOpts.sajuProfileId ??
    buildOpts.sajuProfile?.id ??
    (await resolveActiveSajuProfileId(sb, userId));
  if (!sajuProfileId) return null;

  const loaded = await loadOrBuildDailyInsightContext(sb, {
    userId,
    eventDate: buildOpts.eventDate,
    sajuProfileId,
    build: () => buildDailyInsightContext(buildOpts),
  });
  if (!loaded) return null;
  return {
    ...loaded,
    ctx: hydrateNatalDay(loaded.ctx, buildOpts.sajuProfile ?? null),
  };
}

export function scoreDailyFortune(
  ctx: DailyInsightContext,
  opts: { onboardingCompleted?: boolean; totalXp?: number } = {}
): FortuneDomainResult[] {
  return scoreFortuneDomains(ctx, opts);
}
