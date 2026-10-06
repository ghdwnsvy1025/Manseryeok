import type { TenGod } from "@saju/engine";

export type TenGodFamily = "비겁" | "식상" | "재성" | "관성" | "인성";
export type BranchRelation = "육합" | "삼합" | "충" | "복음" | null;
export type YongsinHit = "용신" | "기신" | null;

/** 엔진이 계산한 오늘 × 내 사주 관계 (v3). 문장은 없다. v4부터는 core가 대신한다 */
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

// ---------------- v4: 사주 코어 판정 (docs/FORTUNE_V4.md) ----------------

/** 코어 luck() 5단계 */
export type Verdict5 = "매우 유리" | "유리" | "보통" | "주의" | "어려움";
/** 코어 용신 라벨. 시간 모름으로 용신이 확정되지 않으면 null */
export type RoleLabel = "용" | "희" | "기" | "구" | "한" | null;

export interface CoreLuckPart {
  /** 한자 한 글자 */
  char: string;
  tenGod: TenGod;
  family: TenGodFamily;
  label: RoleLabel;
  /** 코어 점수 (용 +2, 희 +1, 한 +0.5, 구 −1, 기 −2; 천간 ×1.5. 전왕표면 ±1.5/−3). 용신 없으면 0 */
  score: number;
}

export interface CoreRelationHit {
  pos: "연" | "월" | "일" | "시";
  kind: "충" | "육합" | "삼합" | "반합" | "복음";
  direction: "유리" | "불리" | "중립";
  /** 충은 자리 비중(1~3), 합은 단계(강 2 / 중 1 / 약 0.5) */
  strength: number;
  /** 상대 글자(원국 지지) 또는 합 글자 */
  chars: string;
}

export interface CoreLuckContextItem {
  간지: string;
  판정: Verdict5 | null;
  /** 이 운의 지지와 오늘 지지가 충이면 */
  clash?: { 강도: number; 최고경보: boolean };
  /** 이 운의 지지와 오늘 지지가 유리한 합이면 (육합 또는 용·희 오행 삼합) */
  union?: "육합" | "삼합";
}

export type AreaName = "대인" | "재물" | "직업" | "학업" | "연애" | "가족" | "건강";
export type AreaSignal = "↑" | "→" | "↓";

export interface CoreFortune {
  dayLuck: {
    stem: CoreLuckPart;
    branch: CoreLuckPart;
    total: Verdict5;
    /** "라벨 점수" | "전왕표" | "용신 없음"(시간 모름) */
    method: "라벨 점수" | "전왕표" | "용신 없음";
    /** 천간+지지 합계 (raw) */
    raw: number;
  };
  relations: { hits: CoreRelationHit[]; flags: string[] };
  context: {
    daeun?: CoreLuckContextItem & { 순서: number };
    seun: CoreLuckContextItem & { 해: number };
    wolun?: CoreLuckContextItem;
    입춘전: boolean;
  };
  areas: { area: AreaName; signal: AreaSignal; why: string }[];
  /** 글 재료. 사용자용 낱말로 바꾼 사실 문장 6~10개 (금지어 없음) */
  facts: string[];
  /** luckKeywords (KW-03) */
  keywords: { positive: string[]; negative: string[] };
  /** "시간 모름", "입춘 전" 등 */
  caveats: string[];
  /** 점수 분해. raw + rel + ctx → score01 */
  parts: { raw: number; rel: number; ctx: number; score01: number };
}

export interface FortuneContent {
  version: "v3" | "v4";
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
  /** 영역 신호 줄 (v4). 신호 있는 영역만 1~3개 */
  areas?: { area: AreaName; signal: AreaSignal; line: string }[];
  source: "llm" | "template";
  /** 3단계: 모델을 부른 횟수 (0이면 부르지 않았다) */
  attempts?: number;
  /** 3단계: source가 llm일 때 쓴 모델 ID */
  model?: string;
  /** v3 재료. v4 캐시에는 없다 */
  base?: Omit<BaseFortune, "score"> & { score: number };
  /** v4 재료 */
  core?: CoreFortune;
  /** 맞춤도 줄 옆에 붙이는 한 줄 (예: 시간 모름 안내). 없으면 생략 */
  fitNote?: string;
  personal: PersonalAdjustment;
  /** 전체 기록 수 기준 맞춤도 % */
  fitPercent: number;
  generatedAt: string;
}
