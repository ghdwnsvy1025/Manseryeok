import type { ElementKo, ElementVector } from "@/lib/saju/elementDistribution";
import type { TenGod } from "@/lib/saju/hiddenStems";

export type CalculationMode = "native_with_luck" | "luck_only";

export type LuckKey = "daewoon" | "yearly" | "monthly" | "daily";

export type LuckPillar = {
  stem: string;
  branch: string;
};

export type AstrologyCalcInput = {
  stems: string;
  branches: string;
  calculationMode: CalculationMode;
  daewoon?: LuckPillar | null;
  yearly?: LuckPillar | null;
  monthly?: LuckPillar | null;
  daily?: LuckPillar | null;
  timezone?: string;
  localDate?: string;
};

export type LuckMixRates = {
  original: number;
  daewoon: number;
  yearly: number;
  monthly: number;
  daily: number;
  activeLuckRate: number;
  selected: LuckKey[];
  sourceRuleId: string;
};

export type TenGodFeatureMap = Record<TenGod, number>;

export type RelationFeatureCounts = {
  yukhap: number;
  chung: number;
  hyeong: number;
  pa: number;
  hae: number;
  cheonGanHap: number;
  banghapGroups: number;
  samhapGroups: number;
};

export type AstrologyCalculationResult = {
  calculationMode: CalculationMode;
  percentage: ElementVector;
  originalPercentage: ElementVector;
  luckMixRates: LuckMixRates;
  yinRatio: number;
  yangRatio: number;
  dayMasterKo: string;
  tenGodFeatures: TenGodFeatureMap;
  relationFeatures: RelationFeatureCounts;
  rawCalculationPayload: Record<string, unknown>;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  sourceRuleIds: string[];
  /** 오행 percentage 경로의 명세 일치 여부 */
  elementDistributionStatus: "verified" | "approximate";
  parity: {
    luckMixRates: "verified";
    elementPercentage: "verified" | "approximate";
    tenGods: "verified";
    relations: "verified";
    approximateSections: string[];
  };
};

/** Phase 4 Ridge 입력용 숫자형 특징 (스냅샷 JSON과 분리) */
export type AstrologyFeatureVector = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
  yinRatio: number;
  yangRatio: number;
  /** 비겁·식상·재성·관성·인성 축 */
  axisPeer: number;
  axisOutput: number;
  axisWealth: number;
  axisAuthority: number;
  axisResource: number;
  tenGod_비견: number;
  tenGod_겁재: number;
  tenGod_식신: number;
  tenGod_상관: number;
  tenGod_편재: number;
  tenGod_정재: number;
  tenGod_편관: number;
  tenGod_정관: number;
  tenGod_편인: number;
  tenGod_정인: number;
  rel_yukhap: number;
  rel_chung: number;
  rel_hyeong: number;
  rel_pa: number;
  rel_hae: number;
  rel_cheonGanHap: number;
  luck_daewoon_rate: number;
  luck_yearly_rate: number;
  luck_monthly_rate: number;
  luck_daily_rate: number;
  original_rate: number;
};

export type AstrologyProfileRecord = {
  id: string;
  userId: string | null;
  sajuProfileId: string | null;
  birthDateTime: string | null;
  birthTimezone: string;
  birthLocation: Record<string, unknown> | null;
  calendarCalculationVersion: string;
  originalPillars: Record<string, unknown>;
  originalElementDistribution: ElementVector;
  dayMaster: string;
  monthBranch: string;
  dayBranch: string;
  staticFeaturePayload: Record<string, unknown>;
  theoryVersion: string;
  featureSchemaVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotStatus = "ready" | "failed" | "pending";

export type AstrologySnapshotRecord = {
  id: string;
  userId: string | null;
  profileId: string | null;
  localDate: string;
  timezone: string;
  calculationMode: CalculationMode;
  luckContext: Record<string, unknown>;
  rawCalculationPayload: Record<string, unknown>;
  elementDistribution: ElementVector;
  tenGodFeatures: TenGodFeatureMap;
  relationFeatures: RelationFeatureCounts;
  structuredFeatures: Record<string, unknown>;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  status: SnapshotStatus;
  errorMessage: string | null;
  retryable: boolean;
  createdAt: string;
};

export type AstrologyFeatureVectorRecord = {
  id: string;
  snapshotId: string;
  userId: string | null;
  localDate: string;
  calculationMode: CalculationMode;
  vector: AstrologyFeatureVector;
  featureSchemaVersion: string;
  calculationVersion: string;
  createdAt: string;
};

export type ElementKoPct = ElementKo;
