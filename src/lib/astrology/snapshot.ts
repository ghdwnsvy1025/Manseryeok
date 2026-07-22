/**
 * 스냅샷 멱등 생성 — 일기 저장과 분리.
 * 계산 실패는 일기 성공을 막지 않는다.
 */
import { computeAstrologyFeatures, toFeatureVector } from "./compute";
import {
  dayBranchFromBranches,
  dayMasterFromStems,
  monthBranchFromBranches,
  pillarsToStemBranchStrings,
} from "./pillars";
import { FEATURE_CATALOG_VERSION } from "./featureAllowlist";
import {
  CALENDAR_CALCULATION_VERSION,
  CALCULATION_VERSION,
  FEATURE_SCHEMA_VERSION,
  THEORY_VERSION,
} from "./versions";
import type {
  AstrologyCalcInput,
  AstrologyFeatureVectorRecord,
  AstrologyProfileRecord,
  AstrologySnapshotRecord,
  CalculationMode,
  LuckPillar,
} from "./types";
import type { SajuProfile } from "@/lib/diary/types";
import type { ElementVector } from "@/lib/saju/elementDistribution";

function id(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type AstrologyStorage = {
  getProfileByUser(userId: string | null): Promise<AstrologyProfileRecord | null>;
  upsertProfile(profile: AstrologyProfileRecord): Promise<AstrologyProfileRecord>;
  findSnapshot(query: {
    userId: string | null;
    localDate: string;
    calculationMode: CalculationMode;
    calculationVersion: string;
    featureSchemaVersion: string;
  }): Promise<AstrologySnapshotRecord | null>;
  insertSnapshot(snapshot: AstrologySnapshotRecord): Promise<AstrologySnapshotRecord>;
  insertFeatureVector(
    vector: AstrologyFeatureVectorRecord
  ): Promise<AstrologyFeatureVectorRecord>;
  listSnapshotsByUser(userId: string | null): Promise<AstrologySnapshotRecord[]>;
};

export function buildAstrologyProfileFromSajuProfile(
  saju: SajuProfile,
  opts?: { astrologyId?: string }
): AstrologyProfileRecord {
  const { stems, branches } = pillarsToStemBranchStrings(saju.pillars);
  const native = computeAstrologyFeatures({
    stems,
    branches,
    calculationMode: "native_with_luck",
  });
  const now = new Date().toISOString();
  return {
    id: opts?.astrologyId ?? id(),
    userId: saju.userId ?? null,
    sajuProfileId: saju.id,
    birthDateTime: saju.calculationMetadata?.normalizedSolarDateTime
      ? String(saju.calculationMetadata.normalizedSolarDateTime)
      : `${saju.birthDate}T00:00:00`,
    birthTimezone: saju.timezone || "Asia/Seoul",
    birthLocation: {
      name: saju.locationName ?? null,
      longitude: saju.longitude ?? null,
      latitude: saju.latitude ?? null,
    },
    calendarCalculationVersion:
      saju.calculationVersion || CALENDAR_CALCULATION_VERSION,
    originalPillars: saju.pillars as unknown as Record<string, unknown>,
    originalElementDistribution: native.originalPercentage,
    dayMaster: dayMasterFromStems(stems),
    monthBranch: monthBranchFromBranches(branches),
    dayBranch: dayBranchFromBranches(branches),
    staticFeaturePayload: {
      stems,
      branches,
      yinRatio: native.yinRatio,
      yangRatio: native.yangRatio,
      tenGodFeatures: native.tenGodFeatures,
      relationFeatures: native.relationFeatures,
    },
    theoryVersion: THEORY_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export type EnsureSnapshotInput = {
  storage: AstrologyStorage;
  userId: string | null;
  localDate: string;
  timezone?: string;
  calculationMode: CalculationMode;
  sajuProfile: SajuProfile | null;
  luck?: {
    daewoon?: LuckPillar | null;
    yearly?: LuckPillar | null;
    monthly?: LuckPillar | null;
    daily?: LuckPillar | null;
  };
};

export type EnsureSnapshotResult =
  | { ok: true; snapshot: AstrologySnapshotRecord; reused: boolean; vector: AstrologyFeatureVectorRecord }
  | { ok: false; error: string; retryable: boolean; failedSnapshot?: AstrologySnapshotRecord };

/**
 * 동일 버전 스냅샷이 있으면 재사용. 버전 다르면 신규 생성.
 * 동시 요청은 unique 제약으로 한쪽만 성공 — 실패 시 재조회로 멱등.
 */
export async function ensureAstrologySnapshot(
  input: EnsureSnapshotInput
): Promise<EnsureSnapshotResult> {
  const existing = await input.storage.findSnapshot({
    userId: input.userId,
    localDate: input.localDate,
    calculationMode: input.calculationMode,
    calculationVersion: CALCULATION_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
  });
  if (existing && existing.status === "ready") {
    const vector: AstrologyFeatureVectorRecord = {
      id: id(),
      snapshotId: existing.id,
      userId: input.userId,
      localDate: input.localDate,
      calculationMode: input.calculationMode,
      vector: toFeatureVector({
        calculationMode: existing.calculationMode,
        percentage: existing.elementDistribution,
        originalPercentage: existing.elementDistribution,
        luckMixRates: {
          original: 0,
          daewoon: 0,
          yearly: 0,
          monthly: 0,
          daily: 0,
          activeLuckRate: 0,
          selected: [],
          sourceRuleId: "reuse",
        },
        yinRatio: Number(existing.structuredFeatures.yinRatio ?? 0.5),
        yangRatio: Number(existing.structuredFeatures.yangRatio ?? 0.5),
        dayMasterKo: String(existing.structuredFeatures.dayMasterKo ?? ""),
        tenGodFeatures: existing.tenGodFeatures,
        relationFeatures: existing.relationFeatures,
        rawCalculationPayload: existing.rawCalculationPayload,
        calculationVersion: existing.calculationVersion,
        theoryVersion: existing.theoryVersion,
        featureSchemaVersion: existing.featureSchemaVersion,
        sourceRuleIds: [],
        elementDistributionStatus:
          (existing.structuredFeatures.elementDistributionStatus as
            | "verified"
            | "approximate") ?? "approximate",
        parity: {
          luckMixRates: "verified",
          elementPercentage:
            (existing.structuredFeatures.elementDistributionStatus as
              | "verified"
              | "approximate") ?? "approximate",
          tenGods: "verified",
          relations: "verified",
          approximateSections: Array.isArray(
            existing.structuredFeatures.approximateSections
          )
            ? (existing.structuredFeatures.approximateSections as string[])
            : [],
        },
      }),
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      calculationVersion: CALCULATION_VERSION,
      createdAt: existing.createdAt,
    };
    return { ok: true, snapshot: existing, reused: true, vector };
  }

  if (!input.sajuProfile) {
    return { ok: false, error: "사주 프로필이 없습니다.", retryable: true };
  }

  let profile = await input.storage.getProfileByUser(input.userId);
  if (!profile || profile.sajuProfileId !== input.sajuProfile.id) {
    profile = await input.storage.upsertProfile(
      buildAstrologyProfileFromSajuProfile(input.sajuProfile)
    );
  }

  try {
    const { stems, branches } = pillarsToStemBranchStrings(
      input.sajuProfile.pillars
    );
    const calcInput: AstrologyCalcInput = {
      stems,
      branches,
      calculationMode: input.calculationMode,
      daewoon: input.luck?.daewoon,
      yearly: input.luck?.yearly,
      monthly: input.luck?.monthly,
      daily: input.luck?.daily,
      timezone: input.timezone ?? "Asia/Seoul",
      localDate: input.localDate,
    };
    const result = computeAstrologyFeatures(calcInput);
    const now = new Date().toISOString();
    const snapshot: AstrologySnapshotRecord = {
      id: id(),
      userId: input.userId,
      profileId: profile.id,
      localDate: input.localDate,
      timezone: input.timezone ?? "Asia/Seoul",
      calculationMode: input.calculationMode,
      luckContext: {
        daewoon: input.luck?.daewoon ?? null,
        yearly: input.luck?.yearly ?? null,
        monthly: input.luck?.monthly ?? null,
        daily: input.luck?.daily ?? null,
        luckMixRates: result.luckMixRates,
      },
      rawCalculationPayload: result.rawCalculationPayload,
      elementDistribution: result.percentage,
      tenGodFeatures: result.tenGodFeatures,
      relationFeatures: result.relationFeatures,
      structuredFeatures: {
        dayMasterKo: result.dayMasterKo,
        yinRatio: result.yinRatio,
        yangRatio: result.yangRatio,
        originalPercentage: result.originalPercentage,
        sourceRuleIds: result.sourceRuleIds,
        elementDistributionStatus: result.elementDistributionStatus,
        approximateSections: result.parity.approximateSections,
        parity: result.parity,
        featureCatalogVersion: FEATURE_CATALOG_VERSION,
      },
      calculationVersion: CALCULATION_VERSION,
      theoryVersion: THEORY_VERSION,
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      status: "ready",
      errorMessage: null,
      retryable: false,
      createdAt: now,
    };

    let saved: AstrologySnapshotRecord;
    try {
      saved = await input.storage.insertSnapshot(snapshot);
    } catch {
      const raced = await input.storage.findSnapshot({
        userId: input.userId,
        localDate: input.localDate,
        calculationMode: input.calculationMode,
        calculationVersion: CALCULATION_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      });
      if (raced) {
        return {
          ok: true,
          snapshot: raced,
          reused: true,
          vector: {
            id: id(),
            snapshotId: raced.id,
            userId: input.userId,
            localDate: input.localDate,
            calculationMode: input.calculationMode,
            vector: toFeatureVector(result),
            featureSchemaVersion: FEATURE_SCHEMA_VERSION,
            calculationVersion: CALCULATION_VERSION,
            createdAt: raced.createdAt,
          },
        };
      }
      throw new Error("스냅샷 저장 충돌");
    }

    const vectorRec: AstrologyFeatureVectorRecord = {
      id: id(),
      snapshotId: saved.id,
      userId: input.userId,
      localDate: input.localDate,
      calculationMode: input.calculationMode,
      vector: toFeatureVector(result),
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      calculationVersion: CALCULATION_VERSION,
      createdAt: now,
    };
    await input.storage.insertFeatureVector(vectorRec);
    return { ok: true, snapshot: saved, reused: false, vector: vectorRec };
  } catch (e) {
    const message = e instanceof Error ? e.message : "사주 계산 실패";
    const failed: AstrologySnapshotRecord = {
      id: id(),
      userId: input.userId,
      profileId: profile.id,
      localDate: input.localDate,
      timezone: input.timezone ?? "Asia/Seoul",
      calculationMode: input.calculationMode,
      luckContext: input.luck ?? {},
      rawCalculationPayload: {},
      elementDistribution: emptyPct(),
      tenGodFeatures: {
        비견: 0,
        겁재: 0,
        식신: 0,
        상관: 0,
        편재: 0,
        정재: 0,
        편관: 0,
        정관: 0,
        편인: 0,
        정인: 0,
      },
      relationFeatures: {
        yukhap: 0,
        chung: 0,
        hyeong: 0,
        pa: 0,
        hae: 0,
        cheonGanHap: 0,
        banghapGroups: 0,
        samhapGroups: 0,
      },
      structuredFeatures: {},
      calculationVersion: CALCULATION_VERSION,
      theoryVersion: THEORY_VERSION,
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      status: "failed",
      errorMessage: message,
      retryable: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await input.storage.insertSnapshot(failed);
    } catch {
      /* ignore */
    }
    return { ok: false, error: message, retryable: true, failedSnapshot: failed };
  }
}

function emptyPct(): ElementVector {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}
