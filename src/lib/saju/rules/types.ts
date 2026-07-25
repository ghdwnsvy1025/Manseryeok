import type { Element } from "@/lib/saju/constants";
import type { CanonicalKeywordCode } from "@/lib/journal/keywords/canonical";
import type { DetectedRelation } from "@/lib/saju/interpretation/relations";

export type PillarRole = "year" | "month" | "day" | "hour";

export type Season = "spring" | "summer" | "autumn" | "winter" | "earth_transition";

export type DayMasterStrength = "strong" | "balanced" | "weak";

export type RootingLevel = "full" | "partial" | "none";

export type EvidenceCode =
  | "day_master"
  | "t_zone"
  | "season"
  | "rooting"
  | "projection"
  | "element_force"
  | "central_qi"
  | "flow"
  | "isolation"
  | "yong"
  | "hee"
  | "gi"
  | "visibility"
  | "relations_stored"
  | "relations_scoring_off";

export type Evidence = {
  code: EvidenceCode;
  detail: string;
  weight?: number;
};

export type ElementForce = {
  element: Element;
  /** 0~1 정규화 세력 */
  strengthScore: number;
  /** 0~1 — 실제로 드러나는 정도 (T존·투출 가중) */
  behaviorVisibilityScore: number;
  reasons: string[];
};

export type StemAnalysis = {
  role: PillarRole;
  stem: string;
  stemKo: string;
  element: Element;
  rooting: RootingLevel;
  rootBranches: string[];
  projected: boolean;
  strengthScore: number;
  behaviorVisibilityScore: number;
};

export type StrategyBlock = {
  element: Element | null;
  plainLabel: string;
  rationale: string;
};

export type SajuRuleOutput = {
  ruleVersion: string;
  dayMaster: {
    stem: string;
    stemKo: string;
    element: Element;
    strength: DayMasterStrength;
    strengthScore: number;
  };
  tZone: {
    monthStem: string | null;
    dayBranch: string;
    hourGanji: string | null;
    labels: string[];
  };
  season: {
    monthBranch: string;
    season: Season;
    commandingElement: Element;
  };
  stems: StemAnalysis[];
  projections: Array<{
    stem: string;
    fromBranch: string;
    fromPillar: PillarRole;
    role: "main" | "middle" | "residual";
  }>;
  elementForces: ElementForce[];
  centralQi: {
    element: Element;
    score: number;
    reasons: string[];
  };
  flow: {
    generating: Array<{ from: Element; to: Element; strength: number }>;
    controlling: Array<{ from: Element; to: Element; strength: number }>;
  };
  isolated: Array<{ char: string; role: PillarRole; reason: string }>;
  yongHeeGi: {
    yong: Element;
    hee: Element;
    gi: Element;
    confidence: number;
    notes: string[];
  };
  defaultStrategy: StrategyBlock;
  overuseRisk: StrategyBlock;
  regulationResource: StrategyBlock;
  keywords: Array<{ code: CanonicalKeywordCode; weight: number; reason: string }>;
  relations: {
    detected: DetectedRelation[];
    scoringEnabled: boolean;
    scoreDelta: number;
  };
  confidence: number;
  evidence: Evidence[];
};
