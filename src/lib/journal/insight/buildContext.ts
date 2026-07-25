/**
 * DailyInsightContext 빌더 — 오늘 입력 절대 미포함
 */
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import { entriesStrictlyBefore } from "@/lib/journal/recentA";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import type { KeywordBiasMap } from "@/lib/journal/keywords/learning";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";
import {
  INSIGHT_ENGINE_VERSION,
  type DailyInsightContext,
} from "./types";

function endOfYesterdayIso(eventDate: string): string {
  // eventDate 00:00 KST = 전날 데이터 마감
  return `${eventDate}T00:00:00.000+09:00`;
}

export function buildDailyInsightContext(opts: {
  eventDate: string;
  entries: JournalEntry[];
  enabledCodes: CategoryCode[];
  sajuProfile?: SajuProfile | null;
  keywordBiases?: KeywordBiasMap;
  timezone?: string;
}): DailyInsightContext {
  const priorEntries = entriesStrictlyBefore(opts.entries, opts.eventDate);
  const ctx = buildDailySajuContext(
    opts.eventDate,
    opts.sajuProfile ?? null
  );
  const bTheme = buildBTheme(ctx);

  const enabled =
    opts.enabledCodes.length > 0
      ? opts.enabledCodes
      : ([
          "emotional_balance",
          "energy",
          "recovery_sleep",
          "focus_execution",
          "work_study",
          "relationship",
        ] as CategoryCode[]);

  const bundle = buildContentScoreBundle({
    entries: priorEntries,
    todayDate: opts.eventDate,
    enabledCodes: enabled,
    excludeToday: true,
  });

  const ranking = rankKeywordsForQuestion({
    bundle,
    priorEntries,
    b: bTheme,
    topN: 5,
    keywordBiases: opts.keywordBiases,
  });

  const primary = ranking.top[0] ?? null;
  const tension =
    ranking.top.find((k) => k.code !== primary?.code) ?? ranking.top[1] ?? null;

  const contentScoreByCategory: DailyInsightContext["recentState"]["contentScoreByCategory"] =
    {};
  for (const code of enabled) {
    contentScoreByCategory[code] =
      bundle.contentScoreByCategory[code]?.value ?? null;
  }

  const hasScores = Object.values(contentScoreByCategory).some(
    (v) => typeof v === "number"
  );
  const recentConfidence = hasScores
    ? Math.min(0.9, 0.35 + ranking.priorUniqueDays * 0.02)
    : 0.2;
  const natalConfidence = ctx.tenGod ? 0.55 : 0.25;
  const overallConfidence =
    Math.round(
      (recentConfidence * (1 - ranking.sajuWeight * 0.3) +
        natalConfidence * ranking.sajuWeight) *
        100
    ) / 100;

  return {
    eventDate: opts.eventDate,
    timezone: opts.timezone ?? "Asia/Seoul",
    dataCutoffAt: endOfYesterdayIso(opts.eventDate),
    engineVersion: INSIGHT_ENGINE_VERSION,
    ganjiKo: ctx.ganjiKo,
    bTheme,
    recentState: {
      keywordScores: ranking.top.map((k) => ({
        code: k.code,
        plainLabel: k.plainLabel,
        score: k.score,
      })),
      contentScoreByCategory,
      recentAOverall: bundle.recentAOverall,
      confidence: recentConfidence,
    },
    natalPrior: {
      tenGod: bTheme.tenGod,
      keywords: bTheme.keywords,
      focusHints: bTheme.focusCategoryHints,
      plainSummary: bTheme.plainSummary,
      sajuWeight: ranking.sajuWeight,
      confidence: natalConfidence,
    },
    primaryKeyword: primary?.plainLabel ?? null,
    tensionKeyword: tension?.plainLabel ?? null,
    topKeywords: ranking.top,
    priorUniqueDays: ranking.priorUniqueDays,
    feedbackBiasApplied: ranking.feedbackBiasApplied,
    overallConfidence,
  };
}
