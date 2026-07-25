/**
 * 온보딩 답변 → 개인 prior(OnboardingProfile) 환산
 * — personalImportance: 도메인 선택 우선순위 (selectDailyDomains에 주입)
 * — keywordPrior: canonical 키워드 콜드스타트 편향
 */
import type { CategoryCode } from "@/lib/journal/types";
import type { CanonicalKeywordCode } from "@/lib/journal/keywords/canonical";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTION_COUNT,
  ONBOARDING_VERSION,
  getOnboardingQuestion,
  type OnboardingAnswers,
} from "./questions";

export type OnboardingProfile = {
  version: string;
  /** 0~1, 응답한 문항 비율 */
  completeness: number;
  completed: boolean;
  /** 카테고리별 0~1 중요도 */
  personalImportance: Partial<Record<CategoryCode, number>>;
  /** canonical 키워드별 0~1 prior */
  keywordPrior: Partial<Record<CanonicalKeywordCode, number>>;
  /** 1~10 기준값 */
  baselines: Partial<Record<CategoryCode, number>>;
  stressResponse: string | null;
  changeContext: string | null;
  recordGoal: string | null;
};

/** 1순위 선택은 더 크게 반영 */
const RANK_WEIGHT = [1, 0.7, 0.5];

function addTo<K extends string>(
  map: Partial<Record<K, number>>,
  key: K,
  delta: number
) {
  map[key] = Math.min(1, Math.round(((map[key] ?? 0) + delta) * 1000) / 1000);
}

export function deriveOnboardingProfile(
  answers: OnboardingAnswers
): OnboardingProfile {
  const personalImportance: Partial<Record<CategoryCode, number>> = {};
  const keywordPrior: Partial<Record<CanonicalKeywordCode, number>> = {};
  const baselines: Partial<Record<CategoryCode, number>> = {};

  let answered = 0;
  for (const q of ONBOARDING_QUESTIONS) {
    const values = answers[q.id];
    if (!values || values.length === 0) continue;
    answered += 1;

    values.forEach((value, idx) => {
      const opt = q.options.find((o) => o.value === value);
      if (!opt) return;
      const rank = RANK_WEIGHT[idx] ?? 0.4;
      // 우선순위 문항은 가중치를 크게, 나머지는 보조 신호로
      const catDelta = (q.id === "focus_areas" ? 0.6 : 0.25) * rank;
      const kwDelta = (q.id === "focus_areas" ? 0.5 : 0.3) * rank;

      for (const c of opt.categories ?? []) addTo(personalImportance, c, catDelta);
      for (const k of opt.keywords ?? []) addTo(keywordPrior, k, kwDelta);
      if (opt.baseline != null) {
        for (const c of opt.categories ?? []) baselines[c] = opt.baseline;
      }
    });
  }

  const single = (id: Parameters<typeof getOnboardingQuestion>[0]) =>
    answers[id as keyof OnboardingAnswers]?.[0] ?? null;

  const completeness =
    Math.round((answered / ONBOARDING_QUESTION_COUNT) * 100) / 100;

  return {
    version: ONBOARDING_VERSION,
    completeness,
    completed: answered === ONBOARDING_QUESTION_COUNT,
    personalImportance,
    keywordPrior,
    baselines,
    stressResponse: single("stress_response"),
    changeContext: single("change_context"),
    recordGoal: single("record_goal"),
  };
}

export const EMPTY_ONBOARDING_PROFILE: OnboardingProfile = {
  version: ONBOARDING_VERSION,
  completeness: 0,
  completed: false,
  personalImportance: {},
  keywordPrior: {},
  baselines: {},
  stressResponse: null,
  changeContext: null,
  recordGoal: null,
};
