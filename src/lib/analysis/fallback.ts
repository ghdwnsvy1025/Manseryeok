/**
 * Phase 5 — 분석 UI·서술: 결정론적 fallback 문장
 * LLM 없이 화면이 동작해야 함.
 */
import type { LayerContent, PeriodType } from "./types";
import { isEarlySignalOnly } from "./exposure";

const CORRELATION_NOTE =
  "이 결과는 개인 기록에서 관찰된 상관·동반 경향이며 원인이나 미래 확정이 아닙니다.";

export function correlationNotCausationNote(): string {
  return CORRELATION_NOTE;
}

export function theoryFallback(opts: {
  available: boolean;
  plainSummary?: string | null;
  approximate?: boolean;
}): LayerContent {
  if (!opts.available) {
    return {
      sourceType: "saju_theory",
      title: "명리 이론상",
      body: "이 기간의 검증된 사주 스냅샷이 없어 이론 요약을 표시하지 않습니다.",
      available: false,
    };
  }
  if (opts.approximate) {
    return {
      sourceType: "saju_theory",
      title: "명리 이론상",
      body:
        "일부 오행 배분은 근사 경로입니다. 검증되지 않은 근사 특징은 확정 해석으로 쓰지 않습니다. " +
        (opts.plainSummary || "원국·운의 구조적 흐름만 참고하세요."),
      available: true,
    };
  }
  return {
    sourceType: "saju_theory",
    title: "명리 이론상",
    body:
      opts.plainSummary ||
      "원국과 운의 조합에서 관찰되는 구조적 흐름을 이론 관점으로만 요약합니다. 실제 생활 결과의 확정이 아닙니다.",
    available: true,
  };
}

export function personalRecordFallback(opts: {
  sampleCount: number;
  modelExposureAllowed: boolean;
  dataStage: string | null;
  hasJournalOnFocusDate: boolean | null;
  periodType: PeriodType;
  patternSummary: string | null;
  vsBaselineLabel: string;
  averageRawScore: number | null;
}): LayerContent {
  if (opts.sampleCount < 14) {
    const need = Math.max(0, 14 - opts.sampleCount);
    return {
      sourceType: "personal_records",
      title: "내 기록상",
      body: `유효 기록이 ${opts.sampleCount}개입니다. 개인 패턴을 보려면 약 ${need}개 더 필요합니다. ${CORRELATION_NOTE}`,
      available: false,
    };
  }

  if (opts.periodType === "daily" && opts.hasJournalOnFocusDate === false) {
    return {
      sourceType: "personal_records",
      title: "내 기록상",
      body: "선택한 날짜에 작성된 일기가 없어 개인화 신호를 확정적으로 표시하지 않습니다. 기록을 남긴 뒤 다시 확인해 주세요.",
      available: false,
    };
  }

  if (isEarlySignalOnly(opts.dataStage) || !opts.modelExposureAllowed) {
    const avg =
      opts.averageRawScore != null
        ? `최근 평균 점수는 약 ${opts.averageRawScore.toFixed(1)}점입니다. `
        : "";
    return {
      sourceType: "personal_records",
      title: "내 기록상",
      body:
        `${avg}초기 관찰 신호 단계이거나 모델 결과가 표시 기준을 만족하지 않아, 확정적 방향 예측은 숨깁니다. ` +
        CORRELATION_NOTE,
      available: true,
    };
  }

  return {
    sourceType: "personal_records",
    title: "내 기록상",
    body:
      opts.patternSummary ||
      `최근 기록에서는 개인 기준선 대비 ${opts.vsBaselineLabel === "higher" ? "다소 높은" : opts.vsBaselineLabel === "lower" ? "다소 낮은" : "비슷한"} 경향이 관찰되었습니다. ` +
        CORRELATION_NOTE,
    available: true,
  };
}

export function actionSuggestionFallback(opts: {
  personalAvailable: boolean;
  theoryAvailable: boolean;
  periodType: PeriodType;
}): LayerContent {
  if (!opts.personalAvailable && !opts.theoryAvailable) {
    return {
      sourceType: "combined_suggestion",
      title: "실천 제안",
      body: "기록이 쌓이면 생활 리듬을 점검하는 짧은 제안을 함께 표시합니다. 의료·재정 결정은 해당 전문가와 상의하세요.",
      available: false,
    };
  }
  const horizon =
    opts.periodType === "daily"
      ? "오늘"
      : opts.periodType === "weekly"
        ? "이번 주"
        : "이번 달";
  return {
    sourceType: "combined_suggestion",
    title: "실천 제안",
    body: `${horizon}에는 무리한 단정보다 수면·휴식·식사·가벼운 움직임 등 일반 생활 리듬을 점검해 보세요. 중요 업무가 있다면 우선순위를 짧게 정리하는 것이 도움이 될 수 있습니다. 전문적인 의료·재정 판단은 해당 전문가와 상의하세요.`,
    available: true,
  };
}

export function recordsNeededForStable(sampleCount: number): number | null {
  if (sampleCount >= 30) return null;
  return Math.max(0, 30 - sampleCount);
}
