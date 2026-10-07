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
  /** 코어 점수 (용 +2, 희 +1, 한 +0.5, 구 −1, 기 −2; 천간 ×1.5. 코어 Y-12 보조 용신이면 한신 관성이 희신급). 용신 없으면 0 */
  score: number;
}

export interface CoreRelationHit {
  pos: "연" | "월" | "일" | "시";
  kind: "충" | "육합" | "삼합" | "반합" | "복음";
  /** 충은 코어 luckRelations가 주는 방향. 합·복음은 항상 "중립" (v4.2: 합은 점수 없이 플래그만 — 코어 00_읽는법 원칙 4) */
  direction: "유리" | "불리" | "중립";
  /** 충은 자리 비중(1~3), 합은 단계(강 2 / 중 1 / 약 0.5). 합의 강도는 점수에 들어가지 않는다 */
  strength: number;
  /** 상대 글자(원국 지지) 또는 합 글자 */
  chars: string;
}

export interface CoreLuckContextItem {
  간지: string;
  판정: Verdict5 | null;
  /** 코어 luck 합계점수 (v4.1 ③: 대운·세운은 ctx에 소폭 반영). 용신 없으면 없음 */
  합계?: number;
  /** 코어 luck 플래그 ("용신 손상 …", "운 내부 상충 …"). 대운 것은 facts 문장이 된다 */
  플래그?: string[];
  /** 이 운의 지지와 오늘 지지가 충이면 */
  clash?: { 강도: number; 최고경보: boolean };
  /** 이 운의 지지와 오늘 지지가 합이면 (육합 또는 용·희 오행 삼합). v4.2: 표시용 플래그일 뿐 점수·문장에는 쓰지 않는다 */
  union?: "육합" | "삼합";
}

export type AreaName = "대인" | "재물" | "직업" | "학업" | "연애" | "가족" | "건강";
export type AreaSignal = "↑" | "→" | "↓";
/** v4.2: 영역 줄의 기간. 오늘 = 일진(최대 2), 이달 = 월운(1), 올해 = 세운(1) */
export type AreaPeriod = "오늘" | "이달" | "올해";

export interface CoreFortune {
  dayLuck: {
    stem: CoreLuckPart;
    branch: CoreLuckPart;
    total: Verdict5;
    /** "라벨 점수" | "용신 없음"(시간 모름). 전왕표는 코어 240c91d(2026-10-07)에서 제거됨 */
    method: "라벨 점수" | "용신 없음";
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
  /** 영역 신호. 순서는 오늘(≤2) → 이달(1) → 올해(1). 코어 luckAreas(일운·월운·세운) */
  areas: { period: AreaPeriod; area: AreaName; signal: AreaSignal; why: string }[];
  /**
   * 글 재료. 사용자용 낱말로 바꾼 오늘의 사실 문장 3~10개 (금지어 없음).
   * v4.4: 대운·세운·월운 문장은 기본적으로 없고, 바뀌는 날(월운 = 절기 입절일, 세운 = 입춘, 대운 = 교체일)과 그 운이 오늘과 충인 날에만 한 문장씩 들어간다
   */
  facts: string[];
  /**
   * v4.4: "왜 이런 운세" 근거 표시용 맥락 문장 — 대운·세운·월운 판정과 대운 플래그 문장이 날과 상관없이 항상 들어 있다.
   * 화면(FortuneCard)은 facts 뒤에 이것을 이어 보여 준다. 글(brief)에는 가지 않는다
   */
  contextFacts: string[];
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
  /** 영역 신호 줄 (v4). v4.2: period가 붙고 순서는 오늘(≤2) → 이달(1) → 올해(1), 최대 4. line에 기간 접두는 없다(모델 글은 "이달엔/올해는"으로 시작) */
  areas?: { period: AreaPeriod; area: AreaName; signal: AreaSignal; line: string }[];
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
