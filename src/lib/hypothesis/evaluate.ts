/**
 * 가설 검증 — 기록으로 판정한다.
 *
 * 판정 원칙
 * 1. 표본이 모자라면 판정하지 않는다. "검증 중"이 정직한 상태다.
 * 2. 차이가 임계값 미만이면 "영향 없음"이다. 억지로 결론 내지 않는다.
 * 3. 이론과 반대로 나오면 그것은 "틀림"이 아니라 이 사람의 예외다.
 *
 * 통계적 유의성을 주장하지 않는다. n이 작기 때문이다.
 * 대신 "지금까지의 기록으로는" 이라는 전제를 문구에 담는다.
 */
import { matchesCondition } from "./dayFacts";
import { withIGa } from "./josa";
import {
  METRICS,
  type DayFacts,
  type DayRecord,
  type HypothesisCard,
  type HypothesisEvidence,
  type HypothesisRule,
  type HypothesisStatus,
} from "./types";

/** 판정에 필요한 최소 조건일 / 비조건일 */
export const MIN_MATCHED_DAYS = 5;
export const MIN_UNMATCHED_DAYS = 5;

/** 이 차이 미만이면 "영향 없음"으로 본다 */
const EFFECT_THRESHOLD = {
  happiness10: 0.8,
  ordinal5: 0.4,
} as const;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function evaluateHypothesis(
  rule: HypothesisRule,
  records: DayRecord[],
  factsByDate: Map<string, DayFacts>
): HypothesisCard {
  const matched: number[] = [];
  const unmatched: number[] = [];

  for (const record of records) {
    const value = record.metrics[rule.metric];
    if (value == null || !Number.isFinite(value)) continue;

    const facts = factsByDate.get(record.date);
    if (!facts) continue;

    if (matchesCondition(facts, rule.condition)) {
      matched.push(value);
    } else {
      unmatched.push(value);
    }
  }

  const matchedMean = mean(matched);
  const unmatchedMean = mean(unmatched);
  const gap =
    matchedMean != null && unmatchedMean != null
      ? matchedMean - unmatchedMean
      : null;

  const evidence: HypothesisEvidence = {
    matchedDays: matched.length,
    unmatchedDays: unmatched.length,
    matchedMean: matchedMean != null ? round1(matchedMean) : null,
    unmatchedMean: unmatchedMean != null ? round1(unmatchedMean) : null,
    gap: gap != null ? round1(gap) : null,
    needMatched: MIN_MATCHED_DAYS,
    needUnmatched: MIN_UNMATCHED_DAYS,
  };

  const status = decideStatus(rule, evidence);
  const progress = computeProgress(evidence, status);
  const headline = renderHeadline(rule, status, evidence);

  return { rule, status, evidence, headline, progress };
}

function decideStatus(
  rule: HypothesisRule,
  evidence: HypothesisEvidence
): HypothesisStatus {
  if (
    evidence.matchedDays < MIN_MATCHED_DAYS ||
    evidence.unmatchedDays < MIN_UNMATCHED_DAYS ||
    evidence.gap == null
  ) {
    return "collecting";
  }

  const threshold = EFFECT_THRESHOLD[METRICS[rule.metric].scale];
  if (Math.abs(evidence.gap) < threshold) return "neutral";

  const predictedUp = rule.direction === "higher";
  const observedUp = evidence.gap > 0;

  return predictedUp === observedUp ? "confirmed" : "exception";
}

function computeProgress(
  evidence: HypothesisEvidence,
  status: HypothesisStatus
): number {
  if (status !== "collecting") return 1;

  const matchedRatio = Math.min(evidence.matchedDays / MIN_MATCHED_DAYS, 1);
  const unmatchedRatio = Math.min(evidence.unmatchedDays / MIN_UNMATCHED_DAYS, 1);
  return Math.round(Math.min(matchedRatio, unmatchedRatio) * 100) / 100;
}

function renderHeadline(
  rule: HypothesisRule,
  status: HypothesisStatus,
  evidence: HypothesisEvidence
): string {
  if (status === "collecting") {
    const need = Math.max(0, MIN_MATCHED_DAYS - evidence.matchedDays);
    if (evidence.matchedDays === 0) {
      return "아직 이 조건에 해당하는 날이 오지 않았어요.";
    }
    return `검증 중 — 해당하는 날 ${evidence.matchedDays}일 기록됨. ${need}일 더 필요해요.`;
  }

  const template =
    status === "confirmed"
      ? rule.copy.confirmed
      : status === "exception"
        ? rule.copy.exception
        : rule.copy.neutral;

  const label = METRICS[rule.metric].label;

  return template
    .replace(/\{days\}/g, String(evidence.matchedDays))
    .replace(/\{gap\}/g, evidence.gap != null ? String(Math.abs(evidence.gap)) : "-")
    // 지표 이름마다 받침이 달라 조사를 고정할 수 없다.
    // "행복도가" / "집중·실행이" — 여기서 골라 붙인다.
    .replace(/\{metricJosa\}/g, withIGa(label))
    .replace(/\{metric\}/g, label);
}

/** 여러 가설을 한 번에 */
export function evaluateAll(
  rules: HypothesisRule[],
  records: DayRecord[],
  factsByDate: Map<string, DayFacts>
): HypothesisCard[] {
  return rules.map((rule) => evaluateHypothesis(rule, records, factsByDate));
}

/**
 * 사주 완성도 — 가설이 얼마나 판정됐는지.
 * 카드 시스템이 기여하는 부분만 계산한다(전체 완성도는 기록일수·간지 수집과 합산).
 */
export function hypothesisCompletion(cards: HypothesisCard[]): number {
  if (cards.length === 0) return 0;
  const settled = cards.filter((c) => c.status !== "collecting").length;
  const partial = cards
    .filter((c) => c.status === "collecting")
    .reduce((sum, c) => sum + c.progress, 0);
  return Math.round(((settled + partial) / cards.length) * 100) / 100;
}
