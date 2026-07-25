/**
 * 오늘의 질문 — 결정 레이어 (동기·순수)
 * RAG / OpenAI / Ridge live 를 절대 호출하지 않는다.
 */
import type { BTheme } from "./bTheme";
import type { ContentScoreBundle } from "./contentD";
import type { CategoryCode } from "./types";
import type { KeywordScore } from "./keywords/rank";
import { buildQuestionTemplate } from "./todayQuestionTemplate";

export type QuestionDecision = {
  focusCategory: CategoryCode | null;
  contentScore: number | null;
  topKeywords: string[];
  keywordScores: KeywordScore[];
  templateHint: string;
  /** 결정에 사용된 근거 (설명 가능) */
  evidence: {
    recentAByCategory: ContentScoreBundle["recentAByCategory"];
    dSources: Partial<Record<CategoryCode, string>>;
    sajuWeight?: number;
    priorUniqueDays?: number;
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
}): QuestionDecision {
  const focus = pickFocusCategory(
    opts.bundle,
    opts.enabledCodes,
    opts.b.focusCategoryHints
  );
  const contentScore = focus
    ? opts.bundle.contentScoreByCategory[focus]?.value ?? null
    : opts.bundle.recentAOverall;
  const topKeywords = opts.keywordRanking.top.map((k) => k.plainLabel);
  const templateHint = buildQuestionTemplate({
    b: opts.b,
    focus,
    contentScore,
    topKeywords,
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
    evidence: {
      recentAByCategory: opts.bundle.recentAByCategory,
      dSources,
      sajuWeight: opts.keywordRanking.sajuWeight,
      priorUniqueDays: opts.keywordRanking.priorUniqueDays,
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
