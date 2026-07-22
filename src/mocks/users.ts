import type { UserExperienceMode } from "@/lib/product/modes";
import type { PersonalizationLevel } from "@/lib/product/personalization";

export type MockPersonaId =
  | "new_user"
  | "records_5"
  | "records_15"
  | "records_35"
  | "records_60"
  | "no_saju"
  | "diary_mode"
  | "saju_mode"
  | "study_mode";

export type MockPersona = {
  id: MockPersonaId;
  label: string;
  recordCount: number;
  hasSaju: boolean;
  mode: UserExperienceMode;
  personalization: PersonalizationLevel;
};

export const MOCK_PERSONAS: MockPersona[] = [
  {
    id: "new_user",
    label: "기록 없는 신규",
    recordCount: 0,
    hasSaju: true,
    mode: "balanced",
    personalization: "base",
  },
  {
    id: "records_5",
    label: "기록 5일 · 기본",
    recordCount: 5,
    hasSaju: true,
    mode: "balanced",
    personalization: "base",
  },
  {
    id: "records_15",
    label: "기록 15일 · 초기 신호",
    recordCount: 15,
    hasSaju: true,
    mode: "balanced",
    personalization: "early_signal",
  },
  {
    id: "records_35",
    label: "기록 35일 · 개인 패턴",
    recordCount: 35,
    hasSaju: true,
    mode: "balanced",
    personalization: "personal_pattern",
  },
  {
    id: "records_60",
    label: "기록 60일 · 나의 흐름",
    recordCount: 60,
    hasSaju: true,
    mode: "balanced",
    personalization: "my_flow",
  },
  {
    id: "no_saju",
    label: "사주 미등록",
    recordCount: 8,
    hasSaju: false,
    mode: "diary",
    personalization: "early_signal",
  },
  {
    id: "diary_mode",
    label: "일기 중심 사용자",
    recordCount: 20,
    hasSaju: true,
    mode: "diary",
    personalization: "personal_pattern",
  },
  {
    id: "saju_mode",
    label: "사주 중심 사용자",
    recordCount: 22,
    hasSaju: true,
    mode: "saju",
    personalization: "personal_pattern",
  },
  {
    id: "study_mode",
    label: "공부 중심 사용자",
    recordCount: 18,
    hasSaju: true,
    mode: "study",
    personalization: "early_signal",
  },
];

export const MOCK_HAPPINESS_CONDITIONS = [
  {
    id: "space",
    title: "일정에 여백이 있을 때",
    status: "candidate" as const,
    evidenceCount: 3,
    tags: ["휴식", "여유"],
  },
  {
    id: "clear_intent",
    title: "관계의 의도가 명확할 때",
    status: "observing" as const,
    evidenceCount: 5,
    tags: ["관계", "대화"],
  },
  {
    id: "choice",
    title: "선택권을 가지고 있을 때",
    status: "confirmed" as const,
    evidenceCount: 8,
    tags: ["자율", "일"],
  },
];

export const MOCK_EFFECTIVE_ACTIONS = [
  {
    id: "priority",
    title: "업무 우선순위를 한 가지로 정하기",
    executed: 5,
    helped: 4,
  },
  {
    id: "walk",
    title: "짧은 산책으로 전환하기",
    executed: 3,
    helped: 2,
  },
];

export const MOCK_EASY_SAJU_CARDS = [
  { id: "temper", title: "나의 기본 기질", body: "상황을 빠르게 읽고 움직이려는 경향이 있을 수 있어요." },
  { id: "energy", title: "에너지를 얻는 방식", body: "사람과 외부 활동에서 기운을 얻기 쉬울 수 있어요." },
  { id: "stress", title: "스트레스를 받는 상황", body: "선택지가 없고 기다려야만 할 때 부담이 커질 수 있어요." },
  { id: "relation", title: "관계에서 중요하게 생각하는 것", body: "의도와 방향이 분명한 관계를 선호할 수 있어요." },
  { id: "work", title: "일하는 방식", body: "시작은 빠르고, 마무리에는 여백이 필요할 수 있어요." },
  { id: "recover", title: "회복하는 방식", body: "혼자만의 짧은 정리가 도움이 될 수 있어요." },
];
