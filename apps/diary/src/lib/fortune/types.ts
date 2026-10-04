import type { TenGod } from "@saju/engine";

export type TenGodFamily = "비겁" | "식상" | "재성" | "관성" | "인성";
export type BranchRelation = "육합" | "삼합" | "충" | "복음" | null;
export type YongsinHit = "용신" | "기신" | null;

/** 엔진이 계산한 오늘 × 내 사주 관계. 문장은 없다. */
export interface BaseFortune {
  /** 0~1. 0.5가 보통 */
  score: number;
  tenGod: TenGod;
  family: TenGodFamily;
  /** 오늘 지지와 내 일지의 관계 */
  relation: BranchRelation;
  /** 오늘 지지와 내 월지의 관계 (약하게 반영) */
  monthRelation: BranchRelation;
  yongsin: YongsinHit;
  /** 사람이 읽을 근거. 전문용어는 괄호 안에만 */
  facts: string[];
}

/** 내 기록으로 보정한 결과 */
export interface PersonalAdjustment {
  /** 오늘과 같은 일간 또는 일지를 가진 날의 기록 수 */
  n: number;
  /** 그 날들의 평균 행복도 (1~10). n이 0이면 null */
  mean: number | null;
  /** 오늘과 완전히 같은 60갑자 날의 기록 수와 평균 */
  sameGanjiCount: number;
  sameGanjiMean: number | null;
  /** 기록이 점수에 미친 비중 0~1 */
  weight: number;
  /** 보정 뒤 점수 0~1 */
  score: number;
}

export interface FortuneContent {
  version: "v3";
  date: string;
  dayGanjiKo: string;
  dayGanjiHanja: string;
  /** 1.0~10.0 */
  score: number;
  band: "좋음" | "무난" | "주의";
  headline: string;
  body: string;
  do: string;
  dont: string;
  source: "llm" | "template";
  base: Omit<BaseFortune, "score"> & { score: number };
  personal: PersonalAdjustment;
  /** 전체 기록 수 기준 맞춤도 % */
  fitPercent: number;
  generatedAt: string;
}
