/**
 * 관찰 신호(기분·낮은/높은 상태·사건 태그) → canonical 16 키워드 순위.
 * 결정적(Math.random 금지). 골든 테스트가 이 함수를 검증한다.
 */
import {
  CANONICAL_KEYWORDS,
  canonicalLabel,
  type CanonicalKeywordCode,
} from "./canonical";

export const CANONICAL_RANK_VERSION = "canonical-rank-v1.0.0";

export type CanonicalSignal = {
  /** 기분 라벨: 기쁨/평온/설렘/불안/분노/답답함/슬픔/지침/무덤덤 */
  moods?: string[];
  /** 낮게 나온 카테고리 코드 */
  lowCategories?: string[];
  /** 높게 나온 카테고리 코드 */
  highCategories?: string[];
  /** 사건 태그 코드 */
  tags?: string[];
};

export type CanonicalKeywordScore = {
  code: CanonicalKeywordCode;
  plainLabel: string;
  score: number;
  reasons: string[];
};

type WeightMap = Partial<Record<CanonicalKeywordCode, number>>;

const MOOD_WEIGHTS: Record<string, WeightMap> = {
  기쁨: { achievement: 1.0, vitality: 0.8, reflection_meaning: 0.4 },
  평온: { stability: 1.2, reflection_meaning: 0.6 },
  설렘: { change_acceptance: 2.0, execution: 0.5 },
  불안: { stability: 1.5, change_acceptance: 0.5 },
  분노: { relation_boundary: 2.0, emotion_expression: 1.5, stability: 0.8 },
  답답함: { emotion_expression: 1.5, relation_boundary: 1.2, stability: 0.5 },
  슬픔: { recovery: 1.2, emotion_expression: 1.0, emotion_awareness: 0.8 },
  지침: { recovery: 2.0, responsibility_regulation: 1.2 },
  무덤덤: { emotion_awareness: 1.4, reflection_meaning: 0.6 },
};

const LOW_CATEGORY_WEIGHTS: Record<string, WeightMap> = {
  recovery_sleep: { recovery: 2.0, vitality: 0.5 },
  energy: { vitality: 1.8, recovery: 0.5 },
  emotional_balance: { stability: 1.6, emotion_awareness: 0.6 },
  focus_execution: { focus: 1.8, execution: 0.6 },
  work_study: { achievement: 1.2, focus: 0.6 },
  relationship: { relation_boundary: 1.5, relation_connect: 1.0 },
  finance_resource: { finance_manage: 1.8, decision_organize: 0.6 },
  physical_condition: { recovery: 1.2, vitality: 1.0 },
  change_opportunity: { change_acceptance: 1.2, self_direction: 0.6 },
};

const HIGH_CATEGORY_WEIGHTS: Record<string, WeightMap> = {
  change_opportunity: { change_acceptance: 1.0, execution: 1.0 },
  work_study: { achievement: 1.2, execution: 0.6 },
  focus_execution: { execution: 1.0, focus: 0.5 },
  relationship: { relation_connect: 1.0 },
  finance_resource: { finance_manage: 1.0 },
};

const TAG_WEIGHTS: Record<string, WeightMap> = {
  rest: { recovery: 1.5 },
  illness: { recovery: 1.2, vitality: 0.6 },
  exercise: { vitality: 1.2 },
  work_pressure: { responsibility_regulation: 1.4, focus: 0.8 },
  learning: { focus: 1.0, achievement: 0.6 },
  achievement: { achievement: 1.5, self_direction: 0.4 },
  conflict: { relation_boundary: 2.0, emotion_expression: 0.5 },
  meeting: { relation_connect: 1.5 },
  family: { relation_connect: 1.0, relation_boundary: 0.4 },
  income: { finance_manage: 1.2 },
  big_spend: { finance_manage: 1.0, decision_organize: 1.0 },
  new_start: { change_acceptance: 1.2, execution: 1.5, self_direction: 0.5 },
  travel: { change_acceptance: 1.0, self_direction: 0.6 },
  decision: { decision_organize: 1.5, execution: 0.6 },
  mistake: { responsibility_regulation: 1.0, reflection_meaning: 0.6 },
};

function applyWeights(
  map: Map<CanonicalKeywordCode, CanonicalKeywordScore>,
  weights: WeightMap,
  reason: string
) {
  for (const [code, w] of Object.entries(weights) as Array<
    [CanonicalKeywordCode, number]
  >) {
    const prev = map.get(code);
    if (prev) {
      prev.score += w;
      if (!prev.reasons.includes(reason)) prev.reasons.push(reason);
    } else {
      map.set(code, {
        code,
        plainLabel: canonicalLabel(code),
        score: w,
        reasons: [reason],
      });
    }
  }
}

export function rankCanonicalKeywords(
  signal: CanonicalSignal,
  topN = 3
): { ranked: CanonicalKeywordScore[]; top: CanonicalKeywordScore[] } {
  const map = new Map<CanonicalKeywordCode, CanonicalKeywordScore>();

  for (const m of signal.moods ?? []) {
    const w = MOOD_WEIGHTS[m];
    if (w) applyWeights(map, w, `mood:${m}`);
  }
  for (const c of signal.lowCategories ?? []) {
    const w = LOW_CATEGORY_WEIGHTS[c];
    if (w) applyWeights(map, w, `low:${c}`);
  }
  for (const c of signal.highCategories ?? []) {
    const w = HIGH_CATEGORY_WEIGHTS[c];
    if (w) applyWeights(map, w, `high:${c}`);
  }
  for (const t of signal.tags ?? []) {
    const w = TAG_WEIGHTS[t];
    if (w) applyWeights(map, w, `tag:${t}`);
  }

  // 결정적 정렬: 점수 내림차순 → canonical 고정 순서
  const order = new Map(
    CANONICAL_KEYWORDS.map((k, i) => [k.code, i] as const)
  );
  const ranked = Array.from(map.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0);
  });

  return { ranked, top: ranked.slice(0, topN) };
}
