/**
 * Phase 5 — 분석 UI·서술: 결정론적 분석 조립기
 */
import {
  actionSuggestionFallback,
  correlationNotCausationNote,
  personalRecordFallback,
  recordsNeededForStable,
  theoryFallback,
} from "./fallback";
import { evaluateModelExposure, isEarlySignalOnly } from "./exposure";
import type {
  AnalysisViewModel,
  AssembleInput,
  AssembleScorePoint,
  BaselineSummary,
} from "./types";
import { NARRATIVE_VERSION } from "./types";

function filterValidScores(scores: AssembleScorePoint[]): AssembleScorePoint[] {
  return scores.filter(
    (s) =>
      !s.isNotApplicable &&
      s.rawScore != null &&
      Number.isFinite(s.rawScore) &&
      s.rawScore >= 1 &&
      s.rawScore <= 10
  );
}

function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const d = new Date(`${cur}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function vsBaseline(
  avg: number | null,
  baseline: number | null
): "higher" | "similar" | "lower" | "unavailable" {
  if (avg == null || baseline == null) return "unavailable";
  const d = avg - baseline;
  if (Math.abs(d) < 0.35) return "similar";
  return d > 0 ? "higher" : "lower";
}

/**
 * 순수 조립 — 네트워크/LLM 없음. 수치 누락은 null.
 */
export function assembleAnalysis(input: AssembleInput): AnalysisViewModel {
  const focus = input.focusDate ?? input.periodStart;
  const inRange = input.scores.filter(
    (s) => s.localDate >= input.periodStart && s.localDate <= input.periodEnd
  );
  const validAll = filterValidScores(input.scores);
  const validInPeriod = filterValidScores(inRange);
  const sampleCount = validAll.length;

  const exposure = evaluateModelExposure({
    model: input.model,
    astrology: input.astrology,
    expectedCalculationVersion:
      input.expectedCalculationVersion ?? input.astrology?.calculationVersion,
    expectedFeatureSchemaVersion:
      input.expectedFeatureSchemaVersion ??
      input.astrology?.featureSchemaVersion,
    confidenceFloor: input.confidenceFloor,
  });

  const modelExposureAllowed = exposure.allowed;
  const earlyOnly = isEarlySignalOnly(input.model?.dataStage ?? null);

  const hasJournalOnFocusDate =
    input.periodType === "daily"
      ? input.scores.some(
          (s) =>
            s.localDate === focus &&
            !s.isNotApplicable &&
            s.rawScore != null
        )
      : null;

  const avgPeriod = mean(validInPeriod.map((s) => s.rawScore as number));
  const baselineMean = input.model?.baselineWeightedMean ?? null;
  const label = vsBaseline(avgPeriod, baselineMean);
  const delta =
    avgPeriod != null && baselineMean != null
      ? Math.round((avgPeriod - baselineMean) * 10) / 10
      : null;

  const baselineSummary: BaselineSummary =
    baselineMean == null && avgPeriod == null
      ? null
      : {
          weightedMean: baselineMean,
          mean: avgPeriod,
          coverage30d: null,
          vsBaselineLabel: label,
          deltaRounded: delta,
        };

  const expectedDays = datesInRange(input.periodStart, input.periodEnd);
  const recordedSet = new Set(validInPeriod.map((s) => s.localDate));
  const missingDates = expectedDays.filter((d) => !recordedSet.has(d));
  const topTags = (input.tags || []).slice(0, 8);

  const aggregate =
    input.periodType === "daily"
      ? null
      : {
          recordedDays: recordedSet.size,
          expectedDays: expectedDays.length,
          averageRawScore:
            avgPeriod != null ? Math.round(avgPeriod * 10) / 10 : null,
          topTags,
          missingDates,
        };

  const theory = theoryFallback({
    available: Boolean(input.astrology),
    plainSummary: input.astrology?.theoryPlainSummary,
    approximate: Boolean(input.astrology?.elementDistributionApproximate),
  });

  let patternSummary: string | null = null;
  if (modelExposureAllowed && input.model?.summaryText && !earlyOnly) {
    patternSummary = input.model.summaryText;
  }

  const personal = personalRecordFallback({
    sampleCount,
    modelExposureAllowed: modelExposureAllowed && !earlyOnly,
    dataStage: input.model?.dataStage ?? null,
    hasJournalOnFocusDate,
    periodType: input.periodType,
    patternSummary,
    vsBaselineLabel: label,
    averageRawScore:
      avgPeriod != null ? Math.round(avgPeriod * 10) / 10 : null,
  });

  const action = actionSuggestionFallback({
    personalAvailable: personal.available,
    theoryAvailable: theory.available,
    periodType: input.periodType,
  });

  const limitations: string[] = [];
  if (sampleCount < 14) limitations.push("표본 부족으로 개인 패턴 신뢰도가 낮습니다.");
  if (earlyOnly) limitations.push("early_signal: 초기 관찰만 허용됩니다.");
  if (!modelExposureAllowed) {
    limitations.push("모델 기반 방향 예측은 표시 기준 미충족으로 숨겼습니다.");
  }
  if (input.astrology?.elementDistributionApproximate) {
    limitations.push("일부 사주 특징이 근사 경로입니다.");
  }
  if (hasJournalOnFocusDate === false) {
    limitations.push("선택 날짜에 일기 기록이 없습니다.");
  }

  const verifiedPatternSummary =
    modelExposureAllowed && input.model && !earlyOnly
      ? {
          keys: input.model.featureKeys.slice(0, 12),
          plainSummary: patternSummary,
        }
      : null;

  return {
    periodType: input.periodType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    categoryKey: input.categoryKey,
    categoryLabel: input.categoryLabel,
    dataStage: input.model?.dataStage ?? null,
    sampleCount,
    observationPeriod: {
      from: input.model?.trainingStartDate || input.periodStart,
      to: input.model?.trainingEndDate || input.periodEnd,
    },
    modelStatus: input.model?.modelStatus ?? null,
    predictionVisible: Boolean(input.model?.predictionVisible && modelExposureAllowed),
    modelExposureAllowed: modelExposureAllowed && !earlyOnly,
    confidenceScore: input.model?.confidenceScore ?? null,
    confidenceBand: input.model?.confidenceBand ?? null,
    baselineSummary,
    verifiedPatternSummary,
    astrologyTheoryLayer: theory,
    personalRecordLayer: personal,
    actionSuggestionLayer: action,
    evidence: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      sampleCount,
      confidenceScore: modelExposureAllowed
        ? input.model?.confidenceScore ?? null
        : null,
      confidenceBand: modelExposureAllowed
        ? input.model?.confidenceBand ?? null
        : null,
      modelStatus: input.model?.modelStatus ?? null,
      dataStage: input.model?.dataStage ?? null,
      calculationVersion:
        input.astrology?.calculationVersion ??
        input.model?.calculationVersion ??
        null,
      theoryVersion:
        input.astrology?.theoryVersion ?? input.model?.theoryVersion ?? null,
      featureSchemaVersion:
        input.astrology?.featureSchemaVersion ??
        input.model?.featureSchemaVersion ??
        null,
      modelVersion: modelExposureAllowed
        ? input.model?.modelVersion ?? null
        : null,
      allowlistVersion: input.model?.allowlistVersion ?? null,
      correlationNotCausationNote: correlationNotCausationNote(),
      recordsNeededForStable: recordsNeededForStable(sampleCount),
    },
    limitations,
    versionMetadata: {
      calculationVersion:
        input.astrology?.calculationVersion ??
        input.model?.calculationVersion ??
        null,
      theoryVersion:
        input.astrology?.theoryVersion ?? input.model?.theoryVersion ?? null,
      featureSchemaVersion:
        input.astrology?.featureSchemaVersion ??
        input.model?.featureSchemaVersion ??
        null,
      modelVersion: modelExposureAllowed
        ? input.model?.modelVersion ?? null
        : null,
      allowlistVersion: input.model?.allowlistVersion ?? null,
      narrativeVersion: NARRATIVE_VERSION,
    },
    hasJournalOnFocusDate,
    aggregate,
    hideReasons: exposure.reasons,
  };
}
