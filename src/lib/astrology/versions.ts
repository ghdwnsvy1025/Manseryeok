/**
 * 사주 계산·이론·특징 스키마 버전 — 단일 모듈.
 * knowledge/saju/manifests/versions.json 과 동기화 (테스트로 검증).
 */
export const CALCULATION_VERSION = "saju-calc-1.0.0";
export const THEORY_VERSION = "sajubase-final-2026-07-19";
export const FEATURE_SCHEMA_VERSION = "saju-feature-mvp-1.0.0";
export const CALENDAR_CALCULATION_VERSION = "0.1.0";

export const SAJU_VERSIONS = {
  calculationVersion: CALCULATION_VERSION,
  theoryVersion: THEORY_VERSION,
  featureSchemaVersion: FEATURE_SCHEMA_VERSION,
  calendarCalculationVersion: CALENDAR_CALCULATION_VERSION,
} as const;
