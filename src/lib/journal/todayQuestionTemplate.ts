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

export function buildQuestionTemplate(opts: {
  b: BTheme;
  focus: CategoryCode | null;
  contentScore: number | null;
  topKeywords?: string[];
}): string {
  const name = opts.focus
    ? getCategoryByCode(opts.focus)?.name ?? opts.focus
    : "하루";
  const band = scoreBandLabel(opts.contentScore);
  const kw =
    (opts.topKeywords && opts.topKeywords.length > 0
      ? opts.topKeywords.slice(0, 2).join("·")
      : null) ||
    opts.b.keywords.slice(0, 2).join("·") ||
    "균형";

  if (opts.contentScore == null) {
    return `${opts.b.plainSummary} 오늘은 「${kw}」 중 어떤 마음이 더 컸나요?`;
  }

  if (isLowJournalScore(opts.contentScore)) {
    return `최근 「${name}」 흐름이 ${band} 편이에요. 오늘 ${kw} 사이에서, 스스로에게 가장 버거웠던 순간은 무엇이었나요?`;
  }
  if (isHighJournalScore(opts.contentScore)) {
    return `최근 「${name}」이 비교적 ${band}이에요. 오늘 그 기운을 잘 쓴 순간이 있다면, 무엇이 도움이 되었나요?`;
  }
  return `오늘은 ${kw}가 주제일 수 있어요. 「${name}」 기준으로, 끌리는 쪽과 거리를 두고 싶은 쪽 중 어디가 더 컸나요?`;
}
