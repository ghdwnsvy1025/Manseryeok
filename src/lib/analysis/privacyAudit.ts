/**
 * Phase 5 — 분석 UI·서술: 개인정보·금지 필드 감사
 */
import { buildNarrativeInput } from "./narrativeContract";
import type { AnalysisViewModel } from "./types";

const FORBIDDEN_RE = [
  /userId/i,
  /user_id/i,
  /"id"\s*:\s*"[0-9a-f-]{36}"/i,
  /coefficient/i,
  /email/i,
  /@gmail/i,
  /생년월일/,
  /birth/i,
  /password/i,
  /Bearer\s/i,
  /service_role/i,
  /content"\s*:/, // journal body-like
];

export type PrivacyAuditResult = {
  ok: boolean;
  reasons: string[];
  narrativeInputJson: string;
};

export function auditViewModelPrivacy(vm: AnalysisViewModel): PrivacyAuditResult {
  const reasons: string[] = [];
  const narrative = buildNarrativeInput(vm);
  const blob = JSON.stringify({ vmSanitize: stripVm(vm), narrative });

  for (const re of FORBIDDEN_RE) {
    if (re.test(blob)) reasons.push(`forbidden_pattern:${re}`);
  }

  if (!vm.modelExposureAllowed && narrative.recordLayer.verifiedPatternNote) {
    reasons.push("hidden_pattern_in_narrative");
  }
  if (!vm.modelExposureAllowed && narrative.confidenceBand != null) {
    reasons.push("hidden_confidence_in_narrative");
  }
  if (
    vm.hideReasons.some((r) => r.includes("approximate")) &&
    vm.verifiedPatternSummary?.keys.some((k) =>
      ["wood", "fire", "earth", "metal", "water"].includes(k)
    )
  ) {
    // pattern keys only when exposure allowed — double check
    if (vm.modelExposureAllowed) {
      reasons.push("approximate_keys_exposed");
    }
  }

  // ViewModel itself must not carry coefficients
  if (JSON.stringify(vm).match(/coefficient/i)) {
    reasons.push("vm_has_coefficients");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    narrativeInputJson: JSON.stringify(narrative),
  };
}

function stripVm(vm: AnalysisViewModel) {
  return {
    periodType: vm.periodType,
    periodStart: vm.periodStart,
    periodEnd: vm.periodEnd,
    categoryKey: vm.categoryKey,
    sampleCount: vm.sampleCount,
    modelExposureAllowed: vm.modelExposureAllowed,
    modelStatus: vm.modelStatus,
    hideReasons: vm.hideReasons,
  };
}
