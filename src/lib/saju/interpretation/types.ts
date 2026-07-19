export type ExpertInsightCategory =
  | "daily_relation"
  | "five_elements"
  | "ten_gods"
  | "interaction"
  | "record_pattern"
  | "observation_question";

export type ExpertInsightSection = {
  id: string;
  category: ExpertInsightCategory;
  title: string;
  summary: string;
  evidence: string[];
  recordBased: boolean;
  sampleSize?: number;
  caution?: string;
};

export type BeginnerFlowCard = {
  id: string;
  title: string;
  status: string;
  evidence: string[];
  observationQuestion?: string;
};

export type BeginnerTodayFlow = {
  headline: string;
  cards: BeginnerFlowCard[];
  analysisKind: "basic_saju" | "record_based" | "mixed";
  disclaimer: string;
};

export type RecordPatternInsight = {
  title: string;
  summary: string;
  sampleSize: number;
  dates: string[];
};
