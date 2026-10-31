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
  /** 보정 뒤 점수 0~1. v4.19: base + shift */
  score: number;
  /**
   * v4.19: 기록이 점수를 실제로 움직인 양(0~1 눈금, ±0.08 = ±0.8점). 전체 기록 평균 대비 편차만 쓴다 —
   * clamp(weight × (mean − overallMean) / 9, −0.08, +0.08). 전체 기록 10개 미만 또는 같은 성분 3개 미만이면 0. 옛 캐시엔 없다
   */
  shift?: number;
  /** v4.19: 전체 기록의 평균 행복도 (1~10). 기록이 없으면 null. 옛 캐시엔 없다 */
  overallMean?: number | null;
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
  /** v4.20: 이 관계로 만든 사실 문장(충·복음만). 옛 캐시엔 없다 */
  fact?: string;
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
    /** v4.12: 시간 모름일 때 12개 시주 다수결 일치율(0~1). 점수 유불리 폭에 곱해졌다. 시간을 알면 없음 */
    agreement?: number;
  };
  relations: { hits: CoreRelationHit[]; flags: string[] };
  /** v4.7: 내 용신·희신 오행(개운 칸용). 시간 모름으로 용신이 확정되지 않으면 null. 옛 캐시엔 없다 */
  luckEls?: { 용: "목" | "화" | "토" | "금" | "수"; 희: "목" | "화" | "토" | "금" | "수" | null } | null;
  /** v4.13 (2026-10-15): 내게 필요한 기운의 이름 — 용신 오행과 그 그룹. 글(brief.me.need)·템플릿이 "내게 모자란 금(실속을 챙기는 힘)"으로 쓴다. 용신이 없으면 null, 옛 캐시엔 없다 */
  need?: { 오행: "목" | "화" | "토" | "금" | "수"; 그룹: TenGodFamily } | null;
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

/** v4.19: 모델 호출 한 번의 측정 */
export interface FortuneCallMetric {
  kind: "draft" | "patch" | "rewrite";
  /** 이 호출의 모델 */
  model?: string;
  ms: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** 이 호출의 결과를 검사했을 때 남은 이슈 코드 (통과면 빈 배열). 호출이 실패하면 ["api"]·["json"]·["truncated"]·["refusal"] */
  issueCodes: string[];
}

/** v4.19: 한 편을 만드는 데 든 시간·호출. 본문은 넣지 않는다 */
export interface FortuneMetrics {
  /** 프롬프트 판본 ("v4.19-1a2b3c4d" = 버전 + SYSTEM·스키마 지문) */
  promptVersion: string;
  totalMs: number;
  /** 코어 판정 + 내 기록 보정 */
  coreMs: number;
  /** 계획(plan.ts) + brief */
  briefMs: number;
  calls: FortuneCallMetric[];
  /** 첫 초안이 수리 없이 검사를 통과했는가 */
  firstPass: boolean;
  /** 템플릿으로 떨어졌으면 그 까닭 (no_model · no_key · api · refusal · deadline · unresolved · json · error) */
  fallback?: string;
}

/** v4.19: 코드가 고른 오늘의 내용 계획 요약 (기록·검수용. 화면에는 안 나감) */
export interface FortunePlanSummary {
  /** 핵심: 천간·지지 중 |점수| 큰 쪽 */
  core: { part: "천간" | "지지"; tenGod: TenGod; read: string };
  support: { kind: "기운" | "충" | "복음"; text: string } | null;
  includeContext: boolean;
  contextReason: string | null;
  /** 글로 풀 영역 (최대 2) */
  areas: { period: AreaPeriod; area: AreaName; signal: AreaSignal }[];
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
  /** v4.19: 본문 문장 배열 (body는 이것을 이어 붙인 문자열 — 옛 캐시·화면 호환). 옛 캐시엔 없다 */
  bodySentences?: string[];
  /**
   * 영역 신호 줄 (v4). v4.2: period가 붙고 순서는 오늘(≤2) → 이달(1) → 올해(1), 최대 4. line에 기간 접두는 없다(모델 글은 "이달엔/올해는"으로 시작).
   * v4.19: 화면 호환용 파생 값 — areaSignals(전부) + areaNarratives(모델 문장)로 visible.composeAreas가 만든다. 새로 읽는 쪽은 visible.areasOf(content)를 쓴다
   */
  areas?: { period: AreaPeriod; area: AreaName; signal: AreaSignal; line: string }[];
  /** v4.19: 코어가 계산한 영역 신호 전부(오늘 ≤2 → 이달 1 → 올해 1). 모델이 지울 수 없다. 옛 캐시엔 없다 */
  areaSignals?: { period: AreaPeriod; area: AreaName; signal: AreaSignal; why: string }[];
  /** v4.19: 계획이 고른 영역(최대 2)에 모델이 쓴 문장. 템플릿이면 템플릿 줄. 옛 캐시엔 없다 */
  areaNarratives?: { period: AreaPeriod; area: AreaName; text: string }[];
  /** v4.19: 코어 키워드(KW-03) 그대로 — 화면은 나중에 (core.keywords와 같은 값) */
  keywords?: { positive: string[]; negative: string[] };
  source: "llm" | "template";
  /** 3단계: 모델을 부른 횟수 (0이면 부르지 않았다) */
  attempts?: number;
  /** 3단계: source가 llm일 때 쓴 모델 ID */
  model?: string;
  /** 모델 토큰 사용량 합계 (재작성·검수 포함). 비용 집계용 — night_fortunes.tokens_in/out에도 같은 값이 들어간다 */
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** 템플릿으로 떨어진 까닭이 API 일시 장애(429·5xx·타임아웃)면 "api". 이 결과는 하루 캐시에 쓰지 않는다 (A-3) */
  transient?: "api";
  /** transient일 때 다시 만들어도 되는 시각(ISO). 이 전에는 캐시를 그대로 쓴다 */
  retryAfter?: string;
  /** 같은 날 프로필을 고쳐 다시 만든 횟수. 상한(REGEN_LIMIT)을 넘으면 모델 없이 템플릿만 (B-H1 비용 상한) */
  regen?: number;
  /** v4.15: 사례 블록의 무대 이름(집·길·사람·몸·돈·쉼·말·물건). v4.16부터는 쓰지 않는다(옛 캐시 호환) */
  stage?: string;
  /** v4.16: 의미 태그(주제·감정·상황·영역·장면·권장·피할·제목뜻). v4.19: 모델이 아니라 코드가 계획·최종 글에서 만든다(기록용 — 태그 겹침으로 거부하지 않는다) */
  tags?: { 주제: string; 감정: string; 상황: string; 영역: string; 장면: string; 권장: string; 피할: string; 제목뜻: string };
  /** v4.19: 코드가 고른 내용 계획 요약 */
  plan?: FortunePlanSummary;
  /** v4.19: 시간·호출·토큰 측정 (본문 없음) */
  metrics?: FortuneMetrics;
  /** v4.16~4.18: 모델이 글보다 먼저 정한 판단(후보·핵심·이유·구조·둘째 기운·운 맥락). v4.19부터는 쓰지 않는다(옛 캐시 호환) */
  judge?: { 후보: string[]; 핵심: string; 이유: string; 구조: string; 둘째기운: string; 운맥락: string };
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
