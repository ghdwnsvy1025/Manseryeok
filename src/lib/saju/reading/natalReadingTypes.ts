/**
 * 원국 종합풀이 결과 타입 — 클라이언트/서버 공용 (서버 전용 모듈 의존 없음)
 */
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";

export type NatalReadingTheoryEvidence = {
  content: string;
  similarity: number;
  chunkIndex: number;
};

export type NatalReadingSection = {
  title: string;
  body: string;
};

export type NatalReadingResult = {
  version: "natal-v1";
  promptVersion: string;
  headline: string;
  overview: { oneLiner: string; longForm: string };
  dayMaster: NatalReadingSection;
  pillars: {
    year: NatalReadingSection;
    month: NatalReadingSection;
    day: NatalReadingSection;
    hour: NatalReadingSection;
  };
  domains: {
    personality: NatalReadingSection;
    work: NatalReadingSection;
    relationships: NatalReadingSection;
    love: NatalReadingSection;
    money: NatalReadingSection;
    health: NatalReadingSection;
  };
  daeun: {
    title: string;
    narrative: string;
    chapters: Array<{ label: string; body: string }>;
  };
  growthFormula: string[];
  summary: string;
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: NatalReadingTheoryEvidence[];
  digestVersion: string;
};
