/**
 * Phase 5 — 분석 UI·서술: LLM 입력·출력 계약
 * 숨김 모델·개인정보·원문·계수 금지.
 */
import type { AnalysisViewModel, PeriodType } from "./types";

export type AnalysisNarrativeInput = {
  locale: "ko";
  horizon: PeriodType;
  localDateRange: { from: string; to: string };
  categoryDisplayName: string;
  sampleCount: number;
  dataStage: string | null;
  confidenceBand: string | null;
  baselineDeltaRounded: number | null;
  theoryLayer: {
    available: boolean;
    summary: string;
    sectionIds: string[];
  };
  recordLayer: {
    available: boolean;
    summary: string;
    /** 노출 허용된 검증 패턴만 */
    verifiedPatternNote: string | null;
  };
  suggestionCategories: string[];
  limitations: string[];
  safety: {
    forbidMedicalDiagnosis: true;
    forbidFinancialGuarantee: true;
    forbidDeterministicFate: true;
  };
};

export type AnalysisNarrativeOutput = {
  theoryText: string;
  recordText: string;
  suggestionText: string;
};

const SUGGESTION_CATEGORIES = [
  "sleep_rest",
  "light_activity",
  "meal_rhythm",
  "task_prioritization",
  "journaling",
] as const;

export function buildNarrativeInput(
  vm: AnalysisViewModel
): AnalysisNarrativeInput {
  return {
    locale: "ko",
    horizon: vm.periodType,
    localDateRange: { from: vm.periodStart, to: vm.periodEnd },
    categoryDisplayName: vm.categoryLabel,
    sampleCount: vm.sampleCount,
    dataStage: vm.dataStage,
    confidenceBand: vm.modelExposureAllowed ? vm.confidenceBand : null,
    baselineDeltaRounded: vm.modelExposureAllowed
      ? vm.baselineSummary?.deltaRounded ?? null
      : null,
    theoryLayer: {
      available: vm.astrologyTheoryLayer.available,
      summary: vm.astrologyTheoryLayer.body,
      sectionIds: ["saju_theory_summary"],
    },
    recordLayer: {
      available: vm.personalRecordLayer.available,
      summary: vm.personalRecordLayer.body,
      verifiedPatternNote: vm.modelExposureAllowed
        ? vm.verifiedPatternSummary?.plainSummary ?? null
        : null,
    },
    suggestionCategories: [...SUGGESTION_CATEGORIES],
    limitations: vm.limitations,
    safety: {
      forbidMedicalDiagnosis: true,
      forbidFinancialGuarantee: true,
      forbidDeterministicFate: true,
    },
  };
}

export function assertNarrativeInputSafe(input: AnalysisNarrativeInput): void {
  const blob = JSON.stringify(input);
  const banned = [
    /rawScore/i,
    /coefficient/i,
    /password/i,
    /Bearer\s/i,
    /service_role/i,
    /@gmail\.com/i,
    /birth/i,
    /생년월일/,
    /userId/i,
    /user_id/i,
  ];
  for (const re of banned) {
    if (re.test(blob)) {
      throw new Error(`narrative_input_forbidden_field:${re}`);
    }
  }
}

export function parseNarrativeOutput(raw: unknown): AnalysisNarrativeOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const theoryText = typeof o.theoryText === "string" ? o.theoryText.trim() : "";
  const recordText = typeof o.recordText === "string" ? o.recordText.trim() : "";
  const suggestionText =
    typeof o.suggestionText === "string" ? o.suggestionText.trim() : "";
  if (!theoryText || !recordText || !suggestionText) return null;
  return { theoryText, recordText, suggestionText };
}

export function narrativeFromViewModelFallback(
  vm: AnalysisViewModel
): AnalysisNarrativeOutput {
  return {
    theoryText: vm.astrologyTheoryLayer.body,
    recordText: vm.personalRecordLayer.body,
    suggestionText: vm.actionSuggestionLayer.body,
  };
}
