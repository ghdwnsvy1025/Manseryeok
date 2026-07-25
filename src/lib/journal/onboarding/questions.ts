/**
 * 온보딩 6문항 — 콜드스타트 개인 prior 수집
 * — 사주 용어·운세 표현 금지. 관찰 가능한 생활 신호만 묻는다.
 * — 답변은 personalImportance(카테고리)와 keywordPrior(canonical)로 환산된다.
 */
import type { CategoryCode } from "@/lib/journal/types";
import type { CanonicalKeywordCode } from "@/lib/journal/keywords/canonical";

export const ONBOARDING_VERSION = "onboarding-v1.0.0";

export type OnboardingQuestionId =
  | "focus_areas"
  | "energy_baseline"
  | "recovery_baseline"
  | "stress_response"
  | "change_context"
  | "record_goal";

export type OnboardingOption = {
  value: string;
  label: string;
  /** 이 선택이 강화하는 카테고리 */
  categories?: CategoryCode[];
  /** 이 선택이 강화하는 canonical 키워드 */
  keywords?: CanonicalKeywordCode[];
  /** 1~10 기준값 (baseline 문항 전용) */
  baseline?: number;
};

export type OnboardingQuestion = {
  id: OnboardingQuestionId;
  order: number;
  prompt: string;
  helper?: string;
  /** true면 복수 선택 */
  multi: boolean;
  maxSelect: number;
  options: OnboardingOption[];
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "focus_areas",
    order: 1,
    prompt: "요즘 가장 신경 쓰이는 영역은 어디인가요?",
    helper: "최대 2개까지 고를 수 있어요.",
    multi: true,
    maxSelect: 2,
    options: [
      { value: "physical_condition", label: "몸 컨디션", categories: ["physical_condition"], keywords: ["vitality", "recovery"] },
      { value: "emotional_balance", label: "마음의 여유", categories: ["emotional_balance"], keywords: ["stability", "emotion_awareness"] },
      { value: "recovery_sleep", label: "잠·휴식", categories: ["recovery_sleep"], keywords: ["recovery"] },
      { value: "work_study", label: "일·공부", categories: ["work_study"], keywords: ["achievement", "focus"] },
      { value: "relationship", label: "사람 관계", categories: ["relationship"], keywords: ["relation_connect", "relation_boundary"] },
      { value: "finance_resource", label: "돈·자원", categories: ["finance_resource"], keywords: ["finance_manage"] },
      { value: "change_opportunity", label: "변화·기회", categories: ["change_opportunity"], keywords: ["change_acceptance"] },
    ],
  },
  {
    id: "energy_baseline",
    order: 2,
    prompt: "요즘 하루 에너지는 보통 어떤가요?",
    multi: false,
    maxSelect: 1,
    options: [
      { value: "low", label: "자주 지쳐요", baseline: 3, categories: ["energy"], keywords: ["vitality", "recovery"] },
      { value: "mid", label: "보통이에요", baseline: 6, categories: ["energy"] },
      { value: "high", label: "대체로 괜찮아요", baseline: 8, categories: ["energy"], keywords: ["execution"] },
    ],
  },
  {
    id: "recovery_baseline",
    order: 3,
    prompt: "잠과 휴식은 충분한 편인가요?",
    multi: false,
    maxSelect: 1,
    options: [
      { value: "low", label: "많이 부족해요", baseline: 3, categories: ["recovery_sleep"], keywords: ["recovery"] },
      { value: "mid", label: "그럭저럭이에요", baseline: 6, categories: ["recovery_sleep"] },
      { value: "high", label: "충분한 편이에요", baseline: 8, categories: ["recovery_sleep"], keywords: ["stability"] },
    ],
  },
  {
    id: "stress_response",
    order: 4,
    prompt: "스트레스를 받으면 주로 어떻게 되나요?",
    multi: false,
    maxSelect: 1,
    options: [
      { value: "express", label: "말이나 표현으로 풀어요", keywords: ["emotion_expression"] },
      { value: "hold", label: "혼자 삭이는 편이에요", keywords: ["emotion_awareness", "stability"] },
      { value: "body", label: "몸이 먼저 반응해요", categories: ["physical_condition"], keywords: ["recovery", "vitality"] },
      { value: "scatter", label: "집중이 흐트러져요", categories: ["focus_execution"], keywords: ["focus"] },
    ],
  },
  {
    id: "change_context",
    order: 5,
    prompt: "요즘 큰 변화(이직·이사·관계 등)가 있나요?",
    multi: false,
    maxSelect: 1,
    options: [
      { value: "none", label: "특별히 없어요", keywords: ["stability"] },
      { value: "preparing", label: "준비하고 있어요", categories: ["change_opportunity"], keywords: ["decision_organize", "change_acceptance"] },
      { value: "ongoing", label: "지금 겪고 있어요", categories: ["change_opportunity"], keywords: ["change_acceptance", "execution"] },
    ],
  },
  {
    id: "record_goal",
    order: 6,
    prompt: "기록으로 가장 얻고 싶은 것은 무엇인가요?",
    multi: false,
    maxSelect: 1,
    options: [
      { value: "self_understanding", label: "나를 더 이해하기", keywords: ["reflection_meaning", "emotion_awareness"] },
      { value: "emotion_release", label: "감정 정리하기", keywords: ["emotion_expression", "stability"] },
      { value: "habit", label: "꾸준한 습관 만들기", keywords: ["execution", "self_direction"] },
      { value: "outcome", label: "성과·목표 챙기기", keywords: ["achievement", "focus"] },
    ],
  },
];

export const ONBOARDING_QUESTION_COUNT = ONBOARDING_QUESTIONS.length;

export function getOnboardingQuestion(
  id: string
): OnboardingQuestion | undefined {
  return ONBOARDING_QUESTIONS.find((q) => q.id === id);
}

/** { questionId: [selected option values] } */
export type OnboardingAnswers = Partial<
  Record<OnboardingQuestionId, string[]>
>;

export function validateOnboardingAnswers(
  answers: OnboardingAnswers
): { ok: true } | { ok: false; error: string } {
  for (const [rawId, values] of Object.entries(answers)) {
    const q = getOnboardingQuestion(rawId);
    if (!q) return { ok: false, error: `알 수 없는 문항: ${rawId}` };
    if (!Array.isArray(values)) {
      return { ok: false, error: `${rawId}: 배열이어야 합니다.` };
    }
    if (values.length > q.maxSelect) {
      return {
        ok: false,
        error: `${q.prompt} — 최대 ${q.maxSelect}개까지 선택할 수 있어요.`,
      };
    }
    if (new Set(values).size !== values.length) {
      return { ok: false, error: `${rawId}: 중복 선택은 허용되지 않습니다.` };
    }
    for (const v of values) {
      if (!q.options.some((o) => o.value === v)) {
        return { ok: false, error: `${rawId}: 알 수 없는 선택지 ${v}` };
      }
    }
  }
  return { ok: true };
}
