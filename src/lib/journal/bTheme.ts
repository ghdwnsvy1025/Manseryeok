/**
 * B: 오늘의 사주 주제 (수치에 넣지 않고 질문·명언 주제만 결정)
 */
import type { DailySajuContext } from "@/lib/product/dailySajuContext";
import type { TenGod } from "@/lib/saju/hiddenStems";

export type BTheme = {
  tenGod: TenGod | null;
  keywords: string[];
  focusCategoryHints: string[];
  plainSummary: string;
};

const TEN_GOD_THEME: Record<
  TenGod,
  { keywords: string[]; focus: string[]; summary: string }
> = {
  비견: {
    keywords: ["관계", "경쟁", "동료", "비교"],
    focus: ["relationship", "emotional_balance"],
    summary: "나와 비슷한 기운 — 관계·비교·동행이 주제일 수 있어요.",
  },
  겁재: {
    keywords: ["경쟁", "손실", "나누기", "속도"],
    focus: ["finance_resource", "relationship"],
    summary: "빼앗기거나 나누는 흐름 — 자원·관계 경계가 주제일 수 있어요.",
  },
  식신: {
    keywords: ["표현", "여유", "창작", "즐김"],
    focus: ["focus_execution", "emotional_balance"],
    summary: "표현과 여유 — 만들고 즐기는 리듬이 주제일 수 있어요.",
  },
  상관: {
    keywords: ["표현", "반발", "예민", "말"],
    focus: ["emotional_balance", "relationship"],
    summary: "날카로운 표현 — 감정·말투·예민함이 주제일 수 있어요.",
  },
  편재: {
    keywords: ["기회", "이동", "소비", "유연"],
    focus: ["finance_resource", "change_opportunity"],
    summary: "움직이는 재물·기회 — 선택과 흐름이 주제일 수 있어요.",
  },
  정재: {
    keywords: ["안정", "관리", "현실", "책임"],
    focus: ["finance_resource", "work_study"],
    summary: "안정된 현실 관리 — 책임·정리가 주제일 수 있어요.",
  },
  편관: {
    keywords: ["압박", "규칙", "긴장", "도전"],
    focus: ["work_study", "energy"],
    summary: "긴장과 규율 — 압박 속 실행이 주제일 수 있어요.",
  },
  정관: {
    keywords: ["질서", "평가", "역할", "신뢰"],
    focus: ["work_study", "focus_execution"],
    summary: "역할과 평가 — 책임감·질서가 주제일 수 있어요.",
  },
  편인: {
    keywords: ["아이디어", "직감", "분산", "배움"],
    focus: ["change_opportunity", "recovery_sleep"],
    summary: "직감과 배움 — 생각의 갈래가 주제일 수 있어요.",
  },
  정인: {
    keywords: ["보호", "학습", "회복", "지지"],
    focus: ["recovery_sleep", "emotional_balance"],
    summary: "돌봄과 학습 — 회복·지지가 주제일 수 있어요.",
  },
};

export function buildBTheme(ctx: DailySajuContext): BTheme {
  const base = ctx.tenGod ? TEN_GOD_THEME[ctx.tenGod] : null;
  const keywords = [
    ...(base?.keywords ?? ["흐름", "균형"]),
    ...ctx.relationLabels.slice(0, 2),
  ];
  return {
    tenGod: ctx.tenGod,
    keywords: Array.from(new Set(keywords)).slice(0, 6),
    focusCategoryHints: base?.focus ?? ["emotional_balance", "energy"],
    plainSummary:
      base?.summary ??
      `오늘은 ${ctx.ganjiKo}일 흐름입니다. 몸과 마음의 균형을 살펴보세요.`,
  };
}
