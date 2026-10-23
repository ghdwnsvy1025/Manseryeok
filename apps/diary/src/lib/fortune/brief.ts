// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 사주 코어 content/src/brief.ts의 축소판: 사실 + 낱말 + 금지 사항 + 분량 규칙. 설계: docs/FORTUNE_V4.md "3단계 — 글".
// v4.15 (2026-10-23): 코어 블록 방식 — 사실표(sheet)·사례 무대(stage, 최근 7일 회피)를 더하고 본문 규칙을 블록 네 개로. 이달 한 줄은 areas의 이달 줄로.
import { TEN_GOD_THEME } from "./base";
import { AREA_WORD } from "./core";
import { solarTermOf } from "./solarTerms";
import { BANNED, batchim, namesFromCore } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, PersonalAdjustment } from "./types";

/** 사주 코어 content/validate.ts의 COMMON_BAN·HEALTH_BAN 복사. 하루 운세에서도 같은 선을 지킨다 */
export const CORE_BANNED = [
  "죽음", "사망", "단명", "요절", "이혼", "사별", "파산", "부도", "불륜", "암에", "암이", "수술", "교통사고", "사고를 당", "우울증", "공황", "자살",
  "반드시", "틀림없이", "무조건", "100% 확실", "백프로", "절대로", "팔자가 세", "팔자가 사나",
  "진단", "처방", "영양제", "검진", "치료", "질환", "병원", "복용", "증상", "약을 드", "건강검진",
];
/** 글에 쓰면 안 되는 말 전부 (text.ts BANNED + 코어 금지 낱말) */
export const BANNED_ALL: readonly string[] = [...new Set([...BANNED, ...CORE_BANNED])];

/**
 * 구조 전문용어. 괄호 안에서도 쓰지 않는다.
 * v4.13 (글품질 검수 2026-10-15 §11-2, 00_공통기준 "용어 한 번 + 뜻 한 줄"): 십신 이름 10개·그룹 이름 5개·"오행"·"용신"은 뺐다 — 오늘 기운의 이름을 한 번 대고 맞는지 말하는 글이 된다.
 * 자리·관계 말(일간·일지·천간·지지·삼합·육합·충·대운…)은 그대로 금지: 그건 이름이 아니라 구조 설명이다. 기신·희신·구신·한신도 그대로(이름 대신 "내게 이미 넉넉한 힘"처럼 말한다)
 */
export const JARGON = ["윗글자", "아랫글자", "오늘 글자", "내 글자",
  "십신", "기신", "희신", "구신", "한신", "일간", "일지", "월지", "연지", "시지", "천간", "지지",
  "삼합", "육합", "반합", "방합", "상충", "대운", "세운", "월운", "일진", "사주팔자", "신강", "신약", "칠살",
];
/** 십신 이름 10개. 글에는 brief.today.tenGods에 있는 것만 쓸 수 있다 (validate) */
export const TEN_GOD_NAMES: readonly string[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];

const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥", S_KO = "갑을병정무기경신임계", B_KO = "자축인묘진사오미신유술해";

/** 한자 간지를 한글 읽기로 ("丙午" → "병오", "壬" → "임"). 글은 한글로만 쓰므로 brief에서 먼저 바꾼다 */
export function hanjaToKo(s: string): string {
  return [...s].map((ch) => (STEMS.includes(ch) ? S_KO[STEMS.indexOf(ch)]! : BRANCHES.includes(ch) ? B_KO[BRANCHES.indexOf(ch)]! : ch)).join("");
}

/** 사실 문장을 글 재료로: 한자 간지만 한글로. v4.13: 괄호 속 십신 이름("'표현과 여유'(식신)")은 더 이상 떼지 않는다 — 이름이 지워져 글이 "부족한 쪽"밖에 못 쓰던 원인(검수 §4) */
export function plainFact(f: string): string {
  return hanjaToKo(f);
}

export interface BriefInput {
  core: CoreFortune;
  personal: PersonalAdjustment;
  today: { ko: string; hanja: string; stemKo: string; branchKo: string };
  /** YYYY-MM-DD */
  date: string;
  weekday: string;
  score10: number;
  band: "좋음" | "무난" | "주의";
  /** v4.8: 최근 3일 이 사람의 운세(헤드라인·첫 두 문장). 없으면 빈 배열 */
  recent?: RecentFortune[];
}

/** v4.4: facts 안의 맥락 문장(올해·이달·10년 단위 운). 이것이 있을 때만 글이 그 운을 말할 수 있다 — validate가 같은 정규식으로 본다 */
export const CONTEXT_FACT_RE = /^(올해 운|이달 운|지금 10년 단위 운)/;
export const hasContextFact = (facts: readonly string[]): boolean => facts.some((f) => CONTEXT_FACT_RE.test(f));

/** v4.5: 본문에 그대로 쓰면 추상적으로 읽히는 성격 이름("경쟁과 추진" 같은 'A과 B' 꼴). 생활 속 마음·행동으로 풀어 써야 한다 — 검사기가 본다 */
export const ABSTRACT_LABELS: readonly string[] = Object.values(TEN_GOD_THEME).filter((t) => /[과와] /.test(t));

/** v4.6: 오늘의 짜임. change = 운이 바뀌거나 내 사주와 부딪히는 날(변동 대비) · focus = 한 생활 영역에 신호가 뚜렷한 날 · calm = 큰 신호 없는 날(담백하게) */
export type FortuneAngle = "change" | "focus" | "calm";

/** 엔진 결과로 오늘의 짜임을 고른다. 같은 입력이면 늘 같은 짜임 */
export function angleOf(core: Pick<CoreFortune, "relations" | "areas" | "facts"> & { dayLuck?: Pick<CoreFortune["dayLuck"], "total"> }, band?: "좋음" | "무난" | "주의"): { angle: FortuneAngle; focus: AreaName | null } {
  // v4.8: 변화형은 내 일지·월지와 충인 날, 또는 운이 "바뀌는" 날만(올해·이달 운과 어긋나는 날은 뺀다). 전엔 50% → 목표 15~20%
  const changing =
    core.relations.hits.some((h) => h.kind === "충" && (h.pos === "일" || h.pos === "월")) ||
    core.facts.some((f) => CONTEXT_FACT_RE.test(f) && !f.includes("어긋나"));
  if (changing) return { angle: "change", focus: null };
  // v4.8: 판정이 "보통"이거나 점수 단계가 무난인 날은 담백형 (전엔 영역 신호만 있으면 집중형 → 담백형 2%)
  if (core.dayLuck?.total === "보통" || band === "무난") return { angle: "calm", focus: null };
  const strong = core.areas.find((a) => a.period === "오늘" && a.signal !== "→");
  if (strong) return { angle: "focus", focus: strong.area };
  return { angle: "calm", focus: null };
}

/** v4.8 기억: 최근 운세 한 편의 요약 (헤드라인 + 첫 두 문장) */
export interface RecentFortune {
  date: string;
  headline: string;
  start: string;
  /** v4.9: 그날 "맞아요"(1)·"아니에요"(-1). -1이면 오늘은 그 주제를 앞세우지 않는다 */
  vote?: 1 | -1;
  /** v4.11: 그날의 이달·올해 영역 줄. 신호가 한 달·한 해 내내 같아 같은 사람이 날마다 같은 문장을 읽던 것(되풀이 검토 2026-10-14: B 사주 4일 연속 "올해는 내 속도를 앞세우…") — validate가 같은 뜻을 다른 각도로 쓰게 막는다 */
  areas?: string[];
  /** v4.15: 그날 사례 블록의 무대 이름(집·길·사람…). 최근 7일 무대는 오늘 피한다 */
  stage?: string;
  /** v4.15: 그날 본문의 문장 전부 — 검사기만 본다(모델에는 보내지 않는다, renderBrief가 뗀다). 블록 문장이 최근 3일 문장과 60% 이상 겹치면 탈락 */
  lines?: string[];
}
export function recentFromRows(rows: { fortune_date: string; content: { headline?: string; body?: string; areas?: { period?: string; line?: string }[]; stage?: string } | null }[]): RecentFortune[] {
  return rows
    .filter((r) => r.content?.headline && r.content?.body)
    .map((r) => {
      const areas = (r.content!.areas ?? []).filter((a) => a && a.period !== "오늘" && a.line).map((a) => String(a.line));
      const lines = r.content!.body!.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      return {
        date: r.fortune_date,
        headline: r.content!.headline!,
        start: lines.slice(0, 2).join(" "),
        ...(areas.length ? { areas } : {}),
        ...(r.content!.stage ? { stage: r.content!.stage } : {}),
        lines,
      };
    });
}

/**
 * v4.15 사례 무대(사주 코어 사실표의 "장면 배정 — 연속 반복 금지"를 하루 운세로): 사례 블록이 서는 생활의 자리 여덟.
 * 날짜로 돌리되 최근 7일에 쓴 무대는 건너뛴다. hints는 사례 문장에 적어도 하나 들어가야 하는 낱말(검사기가 본다).
 * 직장 무대는 없다(v4.5 직업 무관 원칙).
 */
export interface Stage { name: string; what: string; hints: readonly string[] }
export const STAGES: readonly Stage[] = [
  { name: "집", what: "집 안에서 — 청소·설거지·빨래·요리·방 정리", hints: ["집", "청소", "설거지", "빨래", "요리", "정리", "방을", "방이"] },
  { name: "길", what: "밖으로 나가 오가는 길 — 버스·지하철·걷기·동네", hints: ["길", "버스", "지하철", "걷", "동네", "나가", "오가"] },
  { name: "사람", what: "가까운 사람과 — 친구·가족과의 대화·안부·만남", hints: ["가까운 사람", "친구", "가족", "안부", "만나", "대화", "이야기"] },
  { name: "몸", what: "몸 — 잠·밥·운동·피로", hints: ["몸", "잠", "밥", "식사", "운동", "피곤", "스트레칭", "졸"] },
  { name: "돈", what: "돈 — 지출·장보기·결제·잔액·공과금", hints: ["돈", "지출", "장보", "결제", "잔액", "통장", "공과금", "사는 것", "살 것"] },
  { name: "쉼", what: "혼자 쉬는 시간 — 취미·영상·산책·음악·책", hints: ["혼자", "취미", "영상", "산책", "음악", "책", "쉬는 시간", "쉴 때"] },
  { name: "말", what: "말 — 답장·메시지·전화·듣기", hints: ["답장", "메시지", "전화", "말하", "말을", "말이", "듣"] },
  { name: "물건", what: "물건 — 사 둔 것·버릴 것·고칠 것·안 쓰는 것", hints: ["물건", "버리", "고치", "사 둔", "안 쓰는", "서랍", "옷장"] },
];
/** 오늘의 무대: 날짜로 돌린 순서에서 최근 무대를 뺀 첫 것 */
export function stageOf(seed: number, avoid: readonly string[]): Stage {
  const start = seed % STAGES.length;
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[(start + i) % STAGES.length]!;
    if (!avoid.includes(s.name)) return s;
  }
  return STAGES[start]!;
}

/** v4.8 진입 방식(1층): 원인→결과는 지키되 날마다 들어가는 길을 바꾼다 */
export type FortuneOpening = "scene" | "reason" | "contrast";
const OPENINGS: FortuneOpening[] = ["scene", "reason", "contrast"];

/** v4.8 표현 돌리기(1층): 엔진의 관계 말을 날짜마다 다른 말로. 뜻은 같다. v4.13: core.ts labelWord의 새 문장(이름을 댐)에 맞춰 꼬리만 돌린다 — 검사기의 추상어·생극 금칙에 걸리는 말은 없다 */
const PHRASE_VARIANTS: [string, string[]][] = [
  ["이라 오늘 반갑게 채워져요", ["이라 오늘 반갑게 채워져요", "이라 오늘 든든하게 메워져요", "이라 오늘 제대로 힘이 돼요"]],
  ["을 옆에서 거들어 줘요", ["을 옆에서 거들어 줘요", "에 힘을 보태 줘요", "을 받쳐 줘요"]],
  ["이라 오늘은 과해지기 쉬워요", ["이라 오늘은 과해지기 쉬워요", "이라 오늘은 지나치기 쉬워요", "이라 오늘은 넘치기 쉬워요"]],
  ["이라 무리하면 쉽게 지쳐요", ["이라 무리하면 쉽게 지쳐요", "이라 애쓸수록 힘이 빠져요", "이라 오래 붙들면 피곤해져요"]],
  ["둘을 합치면 오늘은", ["둘을 합치면 오늘은", "전체로 보면 오늘은", "두 성격을 더하면 오늘은"]],
];
export function varyFact(f: string, seed: number): string {
  let out = f;
  for (const [from, alts] of PHRASE_VARIANTS) if (out.includes(from)) out = out.replace(from, alts[seed % alts.length]!);
  return out;
}
/** 날짜 → 고르는 수 (같은 날이면 늘 같다) */
export function daySeed(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export interface FortuneBrief {
  /**
   * v4.4: solarTerm = 그날이 속한 24절기와 며칠째 ("한로 사흘째"). v4.5: 글에 쓸 수 있는 건 절기 첫날(useSolarTerm)뿐 — 매일 "한로 사흘째…"로 시작하던 것.
   * v4.13: tenGods = 오늘 기운 이름("편관·식신"), elements = 오늘 글자의 오행("임=수, 술=토"), fit = 나에게 맞는지(맞는 편·보통·안 맞는 편·판단 보류). 글은 이름을 한 번 대고 fit을 한 문장으로 쓴다
   */
  today: { date: string; weekday: string; ganji: string; solarTerm: string; useSolarTerm: boolean; solarTermName: string; tenGods: string; elements: string; fit: string };
  /** v4.13: 나에게 필요한 기운의 이름 ("금(재성) · 실속을 챙기는 힘"). 용신이 없으면 null — 그때는 "맞는지"를 말하지 않는다 */
  me: { need: string | null };
  /** v4.13 (2026-10-15 사용자 결정: 이달 한 줄을 매일): 이달 간지·오행·판정 한 줄. 본문 첫 문장이 이 줄을 생활어로 푼다. 월운이 없으면 null */
  month: { ganji: string; elements: string; verdict: string; line: string } | null;
  score: { value: number; band: string; word: string };
  /** v4.6: 오늘의 짜임과 중심 영역(focus일 때만, 생활어 "돈"·"사람"…) */
  angle: FortuneAngle;
  focusArea: string | null;
  /** v4.6: 원인 → 나와의 관계 → 합친 결과. 본문 둘째 단계가 이 순서로 "~라서 ~해요"를 잇는다 */
  chain: string[];
  /** v4.8: 오늘 들어가는 길(scene = 장면부터, reason = 이유부터, contrast = 평소와 견줘서) */
  opening: FortuneOpening;
  /** v4.8: 최근 운세 — 같은 헤드라인 꼴·첫 문장 공식·결론 말을 피한다 (최근 3일) */
  recent: RecentFortune[];
  /** v4.15: 오늘 사례 블록의 무대. 사례 문장에 hints 가운데 하나는 들어가야 한다 */
  stage: { name: string; what: string; hints: readonly string[] };
  /** v4.15: 최근 7일에 쓴 무대 이름 — 오늘은 피했다(기록용) */
  avoidStages: string[];
  /**
   * v4.15 사실표(사주 코어 사실표의 축소판): 글이 벗어나면 안 되는 한 줄들.
   * me = 한 줄 처지(내게 필요한 기운), today = 오늘 기운 이름마다 한 줄 뜻, fit = 나에게 맞는지. 근거 블록은 이 세 줄로만 쓴다
   */
  sheet: {
    me: string;
    today: string;
    fit: string;
    /** 오늘 쓸 문장 꼴(날짜로 돌린다) — 이름+뜻을 대는 꼴과 맞는지를 말하는 꼴. 뜻은 같게, 문장은 이 꼴로 새로. 1차 말뭉치(2026-10-23)에서 "내게 모자란 토, 그러니까 실속을 챙기는 힘"이 18편 중 12편에 박혔다 */
    say: { name: string; fit: string };
  };
  /** v4.8: 단계별 말투 */
  tone: string;
  /** 사용자용 낱말로 바뀐 사실 문장 (한자·십신 없음) */
  facts: string[];
  /** 신호 있는 영역. 이 순서·개수·period·area대로 areas 줄을 쓴다. v4.2: 오늘(≤2) → 이달(1) → 올해(1) */
  areas: { period: AreaPeriod; area: AreaName; word: string; signal: AreaSignal; why: string }[];
  keywords: { positive: string[]; negative: string[] };
  caveats: string[];
  /** 내 기록 숫자. 기록이 없으면 null */
  personal: { n: number; mean: number; sameGanjiCount: number; sameGanjiMean: number | null } | null;
  /** 본문에 넣어야 하는 "내 숫자 한 문장"의 재료. 기록이 없으면 null이고 그때는 기록 이야기를 하지 않는다 */
  mine: string | null;
  /** 글에 써도 되는 숫자 전부. 이 밖의 숫자는 날조로 본다. v4.2: 점수(score.value)는 들어 있지 않다 — 점수는 화면이 보여 준다 */
  allowedNumbers: number[];
  banned: readonly string[];
  jargon: readonly string[];
  rules: {
    headline: string;
    body: string;
    areas: string;
    doDont: string;
    numbers: string;
    mine: string;
    /** v4.4: 요일·절기 장면 규칙 */
    scene: string;
    /** v4.4: 올해·10년 단위 운은 facts에 그 문장이 있을 때만. v4.13: 이달 한 줄(month)은 매일 */
    context: string;
    /** v4.13: 용어는 한 번, 바로 뒤에 뜻 한 줄. 이름 없는 추상어·생극 설명 금지 */
    terms: string;
  };
}

export const BAND_WORD = { 좋음: "수월한 편", 무난: "보통", 주의: "조심할 편" } as const;

/** 글자열 묶음에서 숫자(정수·소수)를 모두 뽑는다. 검사기와 같은 정규식을 쓴다 */
export const NUMBER_RE = /\d+(?:\.\d+)?/g;
export function extractNumbers(texts: string[]): number[] {
  const out = new Set<number>();
  for (const t of texts) for (const m of t.match(NUMBER_RE) ?? []) out.add(Number(m));
  return [...out].sort((a, b) => a - b);
}

export function buildBrief(input: BriefInput): FortuneBrief {
  const { core, personal, today } = input;
  const seed = daySeed(input.date);
  const facts = core.facts.map((f) => varyFact(plainFact(f), seed));
  const caveats = core.caveats.map(hanjaToKo);
  const areas = core.areas.map((a) => ({ period: a.period, area: a.area, word: AREA_WORD[a.area], signal: a.signal, why: plainFact(a.why) }));

  let mine: string | null = null;
  let personalOut: FortuneBrief["personal"] = null;
  if (personal.n > 0 && personal.mean !== null) {
    personalOut = { n: personal.n, mean: personal.mean, sameGanjiCount: personal.sameGanjiCount, sameGanjiMean: personal.sameGanjiMean };
    mine =
      personal.sameGanjiCount > 0 && personal.sameGanjiMean !== null
        ? `지난 ${today.ko}일에 ${personal.sameGanjiCount}번 기록했고 평균 ${personal.sameGanjiMean}점이었어요`
        : `${today.stemKo}${batchim(today.stemKo) ? "이나" : "나"} ${today.branchKo}${batchim(today.branchKo) ? "이" : "가"} 든 날에 ${personal.n}번 기록했고 평균 ${personal.mean}점이었어요`;
  }

  const [y, m, d] = input.date.split("-").map(Number) as [number, number, number];
  const term = solarTermOf(input.date);
  const solarTerm = term.label;
  const allowedNumbers = extractNumbers([
    ...facts,
    ...caveats,
    ...areas.map((a) => a.why),
    ...(mine ? [mine] : []),
    solarTerm,
    String(y), String(m), String(d),
  ]);
  const withContext = hasContextFact(facts);
  const ang = angleOf(core, input.band);
  const names = namesFromCore(core);
  // v4.15: 무대는 최근 7일(입력 recent 전부)에서 피하고, 글 겹침 검사와 프롬프트에는 최근 3일만
  // 날짜 내림차순으로 맞춘다 — index.ts는 내림차순으로 읽지만 말뭉치 스크립트처럼 오름차순으로 넘기면 slice(0, 3)이 가장 오래된 3일을 잡았다 (1차 말뭉치 2026-10-23: 5~7일 전 글과 "겹침"으로 템플릿 6편)
  const recentAll = [...(input.recent ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const avoidStages = [...new Set(recentAll.map((r) => r.stage).filter((s): s is string => Boolean(s)))];
  const stage = stageOf(seed, avoidStages);
  const todayMeaning = [...new Set(names.tenGodList)].map((g) => `${g} = ${TEN_GOD_THEME[g]}`).join(", ");
  const needWord = names.need ? `${names.need.el}(${names.need.power})` : null;
  // 날마다 다른 꼴 — 같은 뜻을 같은 문장으로 옮겨 적지 않게 (검사기는 최근 3일 문장과 겹치면 탈락시킨다).
  // 2차 말뭉치(2026-10-23): 꼴을 보기로만 주니 모델이 "~을 뜻하는 X" 공식으로 되돌아갔다 → 오늘 이름으로 조립한 실제 구절을 준다
  const [gA, gB] = names.tenGodList;
  const tA = TEN_GOD_THEME[gA], tB = TEN_GOD_THEME[gB];
  const eul = (w: string) => (batchim(w) ? "을" : "를");
  const gwa = (w: string) => (batchim(w) ? "과" : "와");
  const NAME_FORMS = gA === gB
    ? [`${gA}(${tA})이 아주 센 날`, `${tA}${eul(tA)} 뜻하는 ${gA}이 두 겹으로 오는 날`, `${gA}은 ${tA}${eul(tA)} 맡는 힘인데 오늘은 그 힘이 아주 세요`, `오늘은 ${tA}(${gA})이 앞에 서는 날`]
    : [`${gA}(${tA})${gwa(gA)} ${gB}(${tB})`, `${tA}${eul(tA)} 뜻하는 ${gA}${gwa(gA)} ${tB}${eul(tB)} 뜻하는 ${gB}`, `${gA}은 ${tA}${eul(tA)} 맡는 힘, ${gB}은 ${tB}${eul(tB)} 맡는 힘`, `오늘은 ${tA}(${gA})${gwa(tA)} ${tB}(${gB})이 함께 서는 날`];
  const FIT_FORMS: Record<string, string[]> = {
    "맞는 편": [`${needWord ?? "필요한 힘"}을 거드는 쪽이라 오늘은 맞는 편이에요`, `오늘 들어오는 힘이 내게 필요한 ${needWord ?? "힘"} 쪽이라 손에 잘 붙어요`, `내게 늘 아쉬운 ${needWord ?? "힘"}이 오늘은 채워지는 편이에요`, `${needWord ?? "필요한 힘"}을 받쳐 주는 날이라 오늘은 수월한 편이에요`],
    보통: ["어느 쪽으로도 기울지 않는 보통 날이에요", "내게 필요한 기운도 이미 넉넉한 기운도 아니라 오늘은 평소와 비슷해요", "오늘 기운은 내게 치우치지 않아 담담하게 가는 날이에요"],
    "안 맞는 편": ["내게 이미 넉넉한 기운이라 오늘은 안 맞는 편이에요", "오늘 들어오는 힘은 내게 이미 넉넉한 쪽이라 과해지기 쉬워요", "내게 필요한 기운이 아니라 오늘은 힘이 덜 붙는 날이에요"],
  };
  const fitForms = FIT_FORMS[names.fit] ?? [];
  const sheet = {
    me: names.need ? `내게 필요한 기운은 ${names.need.el}(${names.need.power})이에요.` : "태어난 시간을 몰라 내게 필요한 기운은 정하지 않았어요.",
    today: todayMeaning,
    fit: names.fit === "판단 보류" ? "맞는지는 말하지 않기 (판단 보류)" : `오늘 기운은 내게 ${names.fit}`,
    say: {
      name: `오늘 이름은 이 구절로 댄다: "${NAME_FORMS[seed % NAME_FORMS.length]!}"`,
      fit: fitForms.length ? `맞는지는 이 꼴로(뜻은 같게): "${fitForms[seed % fitForms.length]!}"` : "맞는지는 말하지 않기",
    },
  };

  return {
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일`, solarTerm, useSolarTerm: term.isTermDay, solarTermName: term.name, tenGods: names.tenGods, elements: names.elements, fit: names.fit },
    me: { need: names.need?.label ?? null },
    month: names.month,
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
    angle: ang.angle,
    focusArea: ang.focus ? AREA_WORD[ang.focus] : null,
    chain: facts.slice(0, 3),
    opening: OPENINGS[seed % OPENINGS.length]!,
    recent: recentAll.slice(0, 3),
    stage: { name: stage.name, what: stage.what, hints: stage.hints },
    avoidStages,
    sheet,
    tone: input.band === "좋음" ? "경쾌하고 가볍게, 들뜨지 않게" : input.band === "주의" ? "차분하게, 기대를 낮춰 주는 위로로" : "담담하게, 일상의 말투로",
    facts,
    areas,
    keywords: core.keywords,
    caveats,
    personal: personalOut,
    mine,
    allowedNumbers,
    banned: BANNED_ALL,
    jargon: JARGON,
    rules: {
      headline: "12자 안팎, 한 구절. 오늘 하루의 느낌을 사실 하나와 묶어서",
      body: `blocks 네 개(근거 1 · 원리 또는 성향 1 · 사례 1 · 처방 1), 순서는 오늘에 맞게 고르되 처방은 첫 블록이 아니게. 블록마다 1~2문장, 전부 4~6문장. 근거 = sheet의 이름·뜻·맞는지(오늘 기운 이름 today.tenGods 한 번 + 괄호 뜻${names.need ? ` + me.need "${names.need.label}"` : ""}). 사례 = "예를 들면"으로 시작, 무대 "${stage.name}"(${stage.what}) 안의 상황 — 무대 낱말(${stage.hints.join("·")}) 가운데 하나는 꼭. 처방 = 언제 + 무엇 한 문장. 이달은 본문에 쓰지 않기(areas의 이달 줄이 말함). 시간대를 차례로 늘어놓지 않기. 같은 성격이 두 번 온 날은 "겹친다" 대신 "아주 강하다/세다"로`,
      areas: areas.length
        ? `areas 배열은 ${areas.length}개, 순서·period·area 이름은 입력과 똑같이. 각 line은 1문장. period가 "이달"이면 "이달엔", "올해"면 "올해는"으로 시작하는 1문장. line은 본문 첫 문장을 되풀이하지 않기`
        : "areas는 빈 배열 []",
      doDont: "do(하면)와 dont(피해요)는 각각 1문장, 구체적 행동. '~해요/~않아요' 꼴",
      numbers: "숫자는 allowedNumbers에 있는 것만. 사실에 없는 숫자·사건·시간·금액을 만들지 않기. 점수는 화면에 있으니 글에 쓰지 않기 (\"N점\", \"N점 만점\" 금지)",
      mine: mine
        ? `본문 어딘가에 내 숫자 한 문장을 꼭 넣기 (재료: "${mine}"). 숫자는 그대로 쓰기`
        : "기록이 없으니 내 기록 이야기를 하지 않기 (기록했다는 말, 평균, 횟수 모두 금지)",
      scene: term.isTermDay
        ? `오늘은 ${input.weekday}, ${term.name}${batchim(term.name) ? "이" : "가"} 시작하는 날. 절기 이름은 한 번만 써도 되고, 요일도 한 번만. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지`
        : `오늘은 ${input.weekday}. 절기 이름(${term.name})은 쓰지 않기. 요일은 꼭 필요할 때만 한 번. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지`,
      context: `${names.month ? `이달 운(month.line "${names.month.line}")은 본문이 아니라 areas의 이달 줄에서만 말하기. ` : ""}${withContext
        ? "facts에 올해·10년 단위 운 문장이 있는 날이니 그 문장도 한 번 생활어로 풀어 넣기 (없는 운은 말하지 않기)"
        : "facts에 올해·10년 단위 운 문장이 없으니 올해 운·10년 단위 운은 말하지 않기 (areas의 올해 줄은 예외)"}`,
      terms: `오늘 기운 이름(${names.tenGods})과 오행(목·화·토·금·수)${names.need ? `, 내게 필요한 기운(${names.need.el})` : ""}은 글 전체에서 각각 한 번만 쓰고 바로 뒤에 뜻을 한 줄로 붙이기. today.tenGods에 없는 십신 이름은 쓰지 않기. jargon의 낱말은 금지. "누르다·눌리다·극하다·생하다" 같은 생·극 설명 금지. "부족한 쪽·모자란 부분·아쉽던 부분·넘치는 힘·채워 주는 힘·힘이 한곳에 모이다·박자가 안 맞다"처럼 무엇인지 이름 없는 말 금지 — 반드시 기운 이름과 ${names.need ? `"${names.need.power}"` : "그 힘의 이름"}을 대기`,
    },
  };
}

/** 모델에 보내는 user 메시지 본문. brief를 그대로 JSON으로. v4.15: recent[].lines(검사기용 최근 문장)은 떼고 보낸다 */
export function renderBrief(b: FortuneBrief): string {
  return JSON.stringify({ ...b, recent: b.recent.map(({ lines: _lines, ...r }) => r) });
}
