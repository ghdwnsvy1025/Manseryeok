/**
 * 오늘의 질문 — 결정 레이어 (동기·순수)
 * RAG / OpenAI / Ridge live 를 절대 호출하지 않는다.
 */
import type { BTheme } from "./bTheme";
import type { ContentScoreBundle } from "./contentD";
import type { CategoryCode } from "./types";
import { getKeyword } from "./keywords/catalog";
import type { KeywordScore } from "./keywords/rank";
import { buildQuestionTemplate } from "./todayQuestionTemplate";
import type {
  FortuneQuestionContext,
  WeekThemeSummary,
} from "./weekThemeSummary";
import { buildWeekThemeSummary } from "./weekThemeSummary";

/** 포커스와 맞는 키워드를 앞에 두고, 질문용으로는 최대 1개만 쓴다 */
function alignTopKeywordsForQuestion(
  focus: CategoryCode | null,
  ranking: KeywordScore[]
): string[] {
  if (ranking.length === 0) return [];
  if (!focus) return [ranking[0]!.plainLabel];

  const aligned = ranking.filter((k) => {
    const def = getKeyword(k.code);
    return def?.relatedCategories.includes(focus);
  });
  const primary = aligned[0] ?? ranking[0]!;
  return [primary.plainLabel];
}

export type QuestionDecision = {
  focusCategory: CategoryCode | null;
  contentScore: number | null;
  topKeywords: string[];
  keywordScores: KeywordScore[];
  templateHint: string;
  weekTheme: WeekThemeSummary;
  /** 결정에 사용된 근거 (설명 가능) */
  evidence: {
    recentAByCategory: ContentScoreBundle["recentAByCategory"];
    dSources: Partial<Record<CategoryCode, string>>;
    sajuWeight?: number;
    priorUniqueDays?: number;
    hasFortuneContext?: boolean;
  };
};

export function pickFocusCategory(
  bundle: ContentScoreBundle,
  enabled: CategoryCode[],
  hints: string[]
): CategoryCode | null {
  for (const h of hints) {
    if (enabled.includes(h as CategoryCode)) return h as CategoryCode;
  }
  let worst: { code: CategoryCode; v: number } | null = null;
  for (const code of enabled) {
    const v = bundle.contentScoreByCategory[code]?.value;
    if (v == null) continue;
    if (!worst || v < worst.v) worst = { code, v };
  }
  return worst?.code ?? enabled[0] ?? null;
}

/**
 * 키워드·포커스·템플릿까지 확정. RAG 청크를 입력으로 받지 않음.
 */
export function decideTodayQuestion(opts: {
  b: BTheme;
  bundle: ContentScoreBundle;
  enabledCodes: CategoryCode[];
  keywordRanking: {
    top: KeywordScore[];
    sajuWeight?: number;
    priorUniqueDays?: number;
  };
  fortune?: FortuneQuestionContext | null;
}): QuestionDecision {
  const focus = pickFocusCategory(
    opts.bundle,
    opts.enabledCodes,
    opts.b.focusCategoryHints
  );
  const contentScore = focus
    ? opts.bundle.contentScoreByCategory[focus]?.value ?? null
    : opts.bundle.recentAOverall;
  const topKeywords = alignTopKeywordsForQuestion(
    focus,
    opts.keywordRanking.top
  );
  const weekTheme = buildWeekThemeSummary({
    enabledCodes: opts.enabledCodes,
    bundle: opts.bundle,
    topKeywords,
  });
  const templateHint = buildQuestionTemplate({
    b: opts.b,
    focus,
    contentScore,
    topKeywords,
    fortune: opts.fortune ?? null,
    weekTheme,
  });

  const dSources: Partial<Record<CategoryCode, string>> = {};
  for (const code of opts.enabledCodes) {
    const src = opts.bundle.dByCategory[code]?.source;
    if (src) dSources[code] = src;
  }

  return {
    focusCategory: focus,
    contentScore,
    topKeywords,
    keywordScores: opts.keywordRanking.top,
    templateHint,
    weekTheme,
    evidence: {
      recentAByCategory: opts.bundle.recentAByCategory,
      dSources,
      sajuWeight: opts.keywordRanking.sajuWeight,
      priorUniqueDays: opts.keywordRanking.priorUniqueDays,
      hasFortuneContext: Boolean(opts.fortune),
    },
  };
}

/** Ridge 섀도 비교 — live 결정에는 넣지 않음 */
export function buildRidgeShadowReport(opts: {
  live: ContentScoreBundle;
  shadow: ContentScoreBundle;
  enabledCodes: CategoryCode[];
}): Array<{
  categoryCode: CategoryCode;
  live: number | null;
  ridgeShadow: number | null;
  delta: number | null;
  liveDSource: string;
  shadowDSource: string;
}> {
  return opts.enabledCodes.map((code) => {
    const liveV = opts.live.contentScoreByCategory[code]?.value ?? null;
    const shadowV = opts.shadow.contentScoreByCategory[code]?.value ?? null;
    const delta =
      liveV != null && shadowV != null
        ? Math.round((shadowV - liveV) * 100) / 100
        : null;
    return {
      categoryCode: code,
      live: liveV,
      ridgeShadow: shadowV,
      delta,
      liveDSource: opts.live.dByCategory[code]?.source ?? "none",
      shadowDSource: opts.shadow.dByCategory[code]?.source ?? "none",
    };
  });
}
