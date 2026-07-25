/**
 * 키워드 스코어링 (질문 엔진 골격)
 * — 오늘 입력은 호출 측에서 이미 제외된 entries만 받는다.
 * — RAG/Ridge와 분리: 이 모듈은 수치·태그·사주 가설·피드백 편향만 사용.
 */
import type { ContentScoreBundle } from "@/lib/journal/contentD";
import type { BTheme } from "@/lib/journal/bTheme";
import type { JournalEntry } from "@/lib/journal/types";
import {
  KEYWORD_CATALOG,
  type KeywordCode,
  type KeywordDefinition,
} from "./catalog";
import { isLowJournalScore } from "@/lib/journal/scoreScale";
import { sajuHypothesisWeight } from "@/lib/journal/questionFeedback";
import type { KeywordBiasMap } from "./learning";

export type KeywordScore = {
  code: KeywordCode;
  plainLabel: string;
  score: number;
  reasons: string[];
};

export type KeywordRanking = {
  ranked: KeywordScore[];
  top: KeywordScore[];
  sajuWeight: number;
  priorUniqueDays: number;
  feedbackBiasApplied: boolean;
};

function bump(
  map: Map<KeywordCode, KeywordScore>,
  def: KeywordDefinition,
  delta: number,
  reason: string
) {
  const prev = map.get(def.code);
  if (prev) {
    prev.score += delta;
    if (!prev.reasons.includes(reason)) prev.reasons.push(reason);
  } else {
    map.set(def.code, {
      code: def.code,
      plainLabel: def.plainLabel,
      score: delta,
      reasons: [reason],
    });
  }
}

function matchBThemeKeyword(bWord: string): KeywordDefinition | undefined {
  const w = bWord.trim();
  return KEYWORD_CATALOG.find(
    (k) => k.plainLabel.includes(w) || w.includes(k.plainLabel.slice(0, 2))
  );
}

/**
 * 최근 상태 + 과거 태그 + 사주 가설 + (선택) 피드백 편향으로 키워드 순위.
 */
export function rankKeywordsForQuestion(opts: {
  bundle: ContentScoreBundle;
  priorEntries: JournalEntry[];
  b: BTheme;
  topN?: number;
  keywordBiases?: KeywordBiasMap;
}): KeywordRanking {
  const map = new Map<KeywordCode, KeywordScore>();
  const topN = opts.topN ?? 3;
  const priorUniqueDays = new Set(opts.priorEntries.map((e) => e.entryDate))
    .size;
  const sajuW = sajuHypothesisWeight(priorUniqueDays);
  const biases = opts.keywordBiases ?? {};
  let feedbackBiasApplied = false;

  for (const kw of opts.b.keywords) {
    const def = matchBThemeKeyword(kw);
    if (def) bump(map, def, 1.2 * sajuW, `saju_hypothesis:${kw}`);
  }
  for (const hint of opts.b.focusCategoryHints) {
    for (const def of KEYWORD_CATALOG) {
      if (def.relatedCategories.includes(hint)) {
        bump(map, def, 0.8 * sajuW, `saju_focus:${hint}`);
      }
    }
  }

  for (const def of KEYWORD_CATALOG) {
    for (const cat of def.relatedCategories) {
      const row =
        opts.bundle.contentScoreByCategory[
          cat as keyof typeof opts.bundle.contentScoreByCategory
        ];
      const v = row?.value;
      if (v == null) continue;
      if (isLowJournalScore(v)) {
        bump(
          map,
          def,
          2.0 + (5.5 - Math.min(v, 5.5)) * 0.3,
          `low_recent:${cat}`
        );
      } else {
        bump(map, def, 0.3, `recent:${cat}`);
      }
    }
  }

  const tagCounts = new Map<string, number>();
  for (const e of opts.priorEntries) {
    for (const t of e.tags) {
      tagCounts.set(t.tagCode, (tagCounts.get(t.tagCode) ?? 0) + 1);
    }
  }
  for (const def of KEYWORD_CATALOG) {
    for (const tag of def.relatedTags) {
      const c = tagCounts.get(tag) ?? 0;
      if (c > 0) bump(map, def, Math.min(2.5, c * 0.7), `prior_tag:${tag}`);
    }
  }

  for (const def of KEYWORD_CATALOG) {
    if (!map.has(def.code)) {
      map.set(def.code, {
        code: def.code,
        plainLabel: def.plainLabel,
        score: 0,
        reasons: ["baseline"],
      });
    }
    const bias = biases[def.code];
    if (bias != null && bias !== 0) {
      bump(map, def, bias, `feedback_bias:${bias}`);
      feedbackBiasApplied = true;
    }
  }

  const ranked = Array.from(map.values()).sort((a, b) => b.score - a.score);
  return {
    ranked,
    top: ranked.slice(0, topN),
    sajuWeight: sajuW,
    priorUniqueDays,
    feedbackBiasApplied,
  };
}
