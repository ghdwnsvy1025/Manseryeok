/**
 * 질문 템플릿만 분리 — 결정/생성 양쪽에서 재사용
 * (순환 import 방지: todayQuestion ↔ questionDecision)
 */
import { getCategoryByCode } from "./categoryCatalog";
import type { BTheme } from "./bTheme";
import type { CategoryCode } from "./types";
import {
  isHighJournalScore,
  isLowJournalScore,
  scoreBandLabel,
} from "./scoreScale";
import type {
  FortuneQuestionContext,
  WeekThemeSummary,
} from "./weekThemeSummary";

/**
 * 질문에는 키워드를 ·로 묶지 않는다.
 * 포커스 카테고리와 맞는 말 하나만 고른다.
 */
export function pickPrimaryQuestionTheme(opts: {
  focus: CategoryCode | null;
  topKeywords?: string[];
  b: BTheme;
}): string {
  const focusName = opts.focus
    ? getCategoryByCode(opts.focus)?.name ?? null
    : null;
  const firstKw = opts.topKeywords?.[0]?.trim() || null;
  const fromB = opts.b.keywords[0]?.trim() || null;

  // 포커스명과 키워드가 겹치지 않으면 포커스(카테고리)를 우선 — "집중·성장" 같은 짝을 막음
  if (focusName) {
    const short = focusName.split(/[·・]/)[0]?.trim() || focusName;
    if (
      firstKw &&
      (focusName.includes(firstKw) ||
        firstKw.includes(short) ||
        short.includes(firstKw))
    ) {
      return firstKw;
    }
    return short;
  }
  return firstKw || fromB || "하루";
}

export function buildQuestionTemplate(opts: {
  b: BTheme;
  focus: CategoryCode | null;
  contentScore: number | null;
  topKeywords?: string[];
  fortune?: FortuneQuestionContext | null;
  weekTheme?: WeekThemeSummary | null;
}): string {
  const name = opts.focus
    ? getCategoryByCode(opts.focus)?.name ?? opts.focus
    : "하루";
  const band = scoreBandLabel(opts.contentScore);
  const theme = pickPrimaryQuestionTheme({
    focus: opts.focus,
    topKeywords: opts.topKeywords,
    b: opts.b,
  });

  const fortuneHint = opts.fortune
    ? [
        opts.fortune.flow ? `흐름 ${opts.fortune.flow}` : null,
        opts.fortune.headline || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const weekHint = opts.weekTheme?.plainLine ?? null;

  if (fortuneHint || weekHint) {
    return `잠들기 전, 오늘 「${theme}」이 마음에 스친 순간이 있었나요?`;
  }

  if (opts.contentScore == null) {
    return `잠들기 전, 오늘 「${theme}」은 어땠나요?`;
  }

  if (isLowJournalScore(opts.contentScore)) {
    return `최근 「${name}」 흐름이 ${band} 편일 수 있어요. 오늘 그 느낌이 스친 순간이 있었나요?`;
  }
  if (isHighJournalScore(opts.contentScore)) {
    return `최근 「${name}」이 비교적 ${band}이에요. 오늘 그게 잘 느껴진 순간이 있었나요?`;
  }
  return `잠들기 전 한 번만요. 오늘 「${theme}」은 어땠나요?`;
}
