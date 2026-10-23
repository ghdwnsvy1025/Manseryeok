// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 사주 코어 content/src/brief.ts의 축소판: 사실 + 낱말 + 금지 사항 + 분량 규칙. 설계: docs/FORTUNE_V4.md "3단계 — 글".
// v4.16 (2026-10-24, 사용자 수정 방향): 사주 이론(십신·오행·합충·판정)은 `inside`(내부 판단)로만 넘기고 본문에는 쓰지 않는다.
//   십신마다 생활 표현 후보(expressions.ts)를 주고, 최근 7일의 의미 태그·14일 제목(`avoid`)과 겹치지 않게 한다. 무대 강제(v4.15)는 뺐다 — 핵심이 장면을 고른다.
import { TEN_GOD_THEME } from "./base";
import { AREA_WORD } from "./core";
import { TEN_GOD_EXPRESSIONS } from "./expressions";
import type { FortuneTags } from "./examples";
import { solarTermOf } from "./solarTerms";
import { BANNED, batchim, namesFromCore } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, PersonalAdjustment, RoleLabel } from "./types";

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
 * v4.16: 십신 이름 10개도 본문에서 금지한다(validate TEN_GOD_NAMES) — 이론은 내부 판단으로만. 오행 이름도 "토 기운"처럼 기운으로 쓰지 않는다
 */
export const JARGON = ["윗글자", "아랫글자", "오늘 글자", "내 글자",
  "십신", "기신", "희신", "구신", "한신", "용신", "일간", "일지", "월지", "연지", "시지", "천간", "지지",
  "삼합", "육합", "반합", "방합", "상충", "대운", "세운", "월운", "일진", "사주팔자", "신강", "신약", "칠살", "오행",
];
/** 십신 이름 10개. v4.16: 글 어디에도 쓸 수 없다 (validate) */
export const TEN_GOD_NAMES: readonly string[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"];

const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥", S_KO = "갑을병정무기경신임계", B_KO = "자축인묘진사오미신유술해";

/** 한자 간지를 한글 읽기로 ("丙午" → "병오", "壬" → "임"). 글은 한글로만 쓰므로 brief에서 먼저 바꾼다 */
export function hanjaToKo(s: string): string {
  return [...s].map((ch) => (STEMS.includes(ch) ? S_KO[STEMS.indexOf(ch)]! : BRANCHES.includes(ch) ? B_KO[BRANCHES.indexOf(ch)]! : ch)).join("");
}

/** 사실 문장을 글 재료로: 한자 간지만 한글로 */
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
  /** v4.8: 최근 이 사람의 운세. v4.16: 14일(태그 7일·제목 14일·첫 문장 3일). 없으면 빈 배열 */
  recent?: RecentFortune[];
}

/** v4.4: facts 안의 맥락 문장(올해·이달·10년 단위 운). 이것이 있을 때만 글이 그 운을 말할 수 있다 — validate가 같은 정규식으로 본다 */
export const CONTEXT_FACT_RE = /^(올해 운|이달 운|지금 10년 단위 운)/;
export const hasContextFact = (facts: readonly string[]): boolean => facts.some((f) => CONTEXT_FACT_RE.test(f));

/** v4.5: 본문에 그대로 쓰면 추상적으로 읽히는 성격 이름("경쟁과 추진" 같은 'A과 B' 꼴). v4.16: 십신 이름이 금지라 이 이름도 본문에서 그대로 쓰면 탈락 */
export const ABSTRACT_LABELS: readonly string[] = Object.values(TEN_GOD_THEME).filter((t) => /[과와] /.test(t));

/** v4.6: 오늘의 짜임. change = 운이 바뀌거나 내 사주와 부딪히는 날(변동 대비) · focus = 한 생활 영역에 신호가 뚜렷한 날 · calm = 큰 신호 없는 날(담백하게) */
export type FortuneAngle = "change" | "focus" | "calm";

/** 엔진 결과로 오늘의 짜임을 고른다. 같은 입력이면 늘 같은 짜임 */
export function angleOf(core: Pick<CoreFortune, "relations" | "areas" | "facts"> & { dayLuck?: Pick<CoreFortune["dayLuck"], "total"> }, band?: "좋음" | "무난" | "주의"): { angle: FortuneAngle; focus: AreaName | null } {
  const changing =
    core.relations.hits.some((h) => h.kind === "충" && (h.pos === "일" || h.pos === "월")) ||
    core.facts.some((f) => CONTEXT_FACT_RE.test(f) && !f.includes("어긋나"));
  if (changing) return { angle: "change", focus: null };
  if (core.dayLuck?.total === "보통" || band === "무난") return { angle: "calm", focus: null };
  const strong = core.areas.find((a) => a.period === "오늘" && a.signal !== "→");
  if (strong) return { angle: "focus", focus: strong.area };
  return { angle: "calm", focus: null };
}

/** v4.8 기억: 최근 운세 한 편의 요약 */
export interface RecentFortune {
  date: string;
  headline: string;
  /** 첫 두 문장 (3일 안 글자 겹침 검사) */
  start: string;
  /** v4.9: 그날 "맞아요"(1)·"아니에요"(-1). -1이면 오늘은 그 주제를 앞세우지 않는다 */
  vote?: 1 | -1;
  /** v4.11: 그날의 이달·올해 영역 줄 */
  areas?: string[];
  /** v4.15: 그날 사례 무대 이름 (옛 캐시 호환) */
  stage?: string;
  /** v4.15: 그날 본문 문장 전부 — 검사기만 본다 */
  lines?: string[];
  /** v4.16: 그날의 의미 태그. 최근 7일과 2개 이상 뜻이 같으면 다시 쓴다 (validate) */
  tags?: FortuneTags;
}
export function recentFromRows(rows: { fortune_date: string; content: { headline?: string; body?: string; areas?: { period?: string; line?: string }[]; stage?: string; tags?: FortuneTags } | null }[]): RecentFortune[] {
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
        ...(r.content!.tags ? { tags: r.content!.tags } : {}),
      };
    });
}

/** 날짜 → 고르는 수 (같은 날이면 늘 같다) */
export function daySeed(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** v4.16: 오늘 들어온 기운 하나의 내부 판단 — 이름·뜻·라벨·읽기(활용/보통/과함/보류)·오늘 쓸 수 있는 생활 표현 */
export interface InsideTenGod {
  name: string;
  meaning: string;
  role: RoleLabel;
  read: "활용" | "보통" | "과함" | "보류";
  /** 이 기운이 오늘 나타나기 쉬운 모습 — 최근 7일 태그와 겹치는 것은 뺐다. 그대로 옮겨 적지 말고 핵심에 맞는 하나를 골라 풀어 쓴다 */
  expressions: string[];
}

export interface FortuneBrief {
  today: { date: string; weekday: string; ganji: string; solarTerm: string; useSolarTerm: boolean; solarTermName: string; tenGods: string; elements: string; fit: string };
  /** v4.13: 나에게 필요한 기운의 이름. v4.16: 내부 판단용 */
  me: { need: string | null };
  /** v4.13: 이달 간지·오행·판정 한 줄. v4.16: 오늘 행동을 바꿀 때만 본문에 녹인다(areas 줄로 보이지 않는다) */
  month: { ganji: string; elements: string; verdict: string; line: string } | null;
  score: { value: number; band: string; word: string };
  angle: FortuneAngle;
  focusArea: string | null;
  /**
   * v4.16 내부 판단 — 본문에 쓰지 않는다. 오늘 기운 둘(같으면 하나)의 이름·뜻·읽기·생활 표현 후보, 전체 판정, 둘째 기운을 쓸 조건.
   * 모델은 여기서 "오늘 나타날 생활 변화 후보 3~5개"를 뽑고 핵심 하나를 고른다
   */
  inside: {
    tenGods: InsideTenGod[];
    /** 전체: 맞는 편·보통·안 맞는 편·판단 보류 */
    fit: string;
    /** 내게 필요한 기운(있으면) — "토(실속을 챙기는 힘)". 본문에는 쓰지 않는다 */
    need: string | null;
    /** 엔진 사실 문장(한글). 둘째 기운·합충·운 맥락의 근거 */
    facts: string[];
    /** 이달·올해 운의 방향 — 오늘과 반대라 행동을 조절하거나 오늘을 세게 할 때만 본문에 녹인다 */
    context: string[];
    /** 단계별 조언 방향 (6항) */
    direction: string;
  },
  /** v4.16 피할 것 — 최근 7일 의미 태그(날짜별), 최근 14일 제목, 최근 7일 장면. 같은 뜻을 표현만 바꿔 쓰면 탈락. lines = 최근 7일 본문 문장(검사기용, 모델에는 안 보냄) */
  avoid: { tags: { date: string; tags: FortuneTags }[]; headlines: string[]; scenes: string[]; lines?: { date: string; lines: string[] }[] };
  /** 최근 3일 첫 두 문장(글자 겹침 검사·vote). lines는 검사기용이라 모델에는 보내지 않는다 */
  recent: RecentFortune[];
  /** 단계별 말투 */
  tone: string;
  /** 사용자용 낱말로 바뀐 사실 문장 (한자 없음). 내부 판단용 */
  facts: string[];
  /** 엔진이 신호를 낸 영역 전부(오늘 ≤2 → 이달 1 → 올해 1). 모델은 이 가운데 오늘 핵심에 맞는 0~3개만 골라 areas 줄을 쓴다 (부분집합·순서 유지) */
  areas: { period: AreaPeriod; area: AreaName; word: string; signal: AreaSignal; why: string }[];
  keywords: { positive: string[]; negative: string[] };
  caveats: string[];
  personal: { n: number; mean: number; sameGanjiCount: number; sameGanjiMean: number | null } | null;
  mine: string | null;
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
    scene: string;
    context: string;
    terms: string;
  };
}

export const BAND_WORD = { 좋음: "수월한 편", 무난: "보통", 주의: "조심할 편" } as const;
/** v4.16 6항: 단계는 문장 톤과 조언 방향을 정하는 내부 정보 */
export const BAND_DIRECTION = {
  좋음: "적극적으로 행동해도 좋은 방향 — 미뤄 둔 일을 처리하기, 먼저 연락하기, 정리해 두면 결과가 빨리 나올 수 있음",
  무난: "조건을 붙여 조절하는 방향 — 서두르지만 않으면 무난, 하던 일을 유지하는 쪽이 편함",
  주의: "새 행동보다 실수 방지와 조절 — 바로 결정하기보다 한 번 더 확인, 기분이 올라온 상태에선 중요한 말을 미루기",
} as const;

/** 글자열 묶음에서 숫자(정수·소수)를 모두 뽑는다. 검사기와 같은 정규식을 쓴다 */
export const NUMBER_RE = /\d+(?:\.\d+)?/g;
export function extractNumbers(texts: string[]): number[] {
  const out = new Set<number>();
  for (const t of texts) for (const m of t.match(NUMBER_RE) ?? []) out.add(Number(m));
  return [...out].sort((a, b) => a - b);
}

const readOf = (role: RoleLabel, method: CoreFortune["dayLuck"]["method"]): InsideTenGod["read"] =>
  method === "용신 없음" || role === null ? "보류" : role === "용" || role === "희" ? "활용" : role === "한" ? "보통" : "과함";

/** 태그 문장과 표현 후보가 같은 뜻인지(앞 두 글자 어간이 둘 이상 겹침) — 최근에 쓴 표현을 오늘 후보에서 뺀다 */
function sharesMeaning(expr: string, tagText: string, min = 2): boolean {
  const stems = (s: string) => new Set(s.replace(/[.,!?'"()·]/g, " ").split(/\s+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)));
  const a = stems(expr), b = stems(tagText);
  let n = 0;
  for (const s of a) if (b.has(s)) n++;
  return n >= min;
}

export function buildBrief(input: BriefInput): FortuneBrief {
  const { core, today } = input;
  const seed = daySeed(input.date);
  const facts = core.facts.map(plainFact);
  const caveats = core.caveats.map(hanjaToKo);
  const areas = core.areas.map((a) => ({ period: a.period, area: a.area, word: AREA_WORD[a.area], signal: a.signal, why: plainFact(a.why) }));

  // v4.17 (2026-10-24): 내 기록 숫자(횟수·평균)는 글에 넣지 않는다 — 카드의 "운세 / 내 기록" 막대가 따로 보여 준다.
  // v4.2~4.16은 기록이 있으면 "N번 기록했고 평균 M점" 문장을 꼭 넣게 했는데, 실제 사용자 글에 "신이나 미가 든 날엔 2번 기록했는데 평균 7.5점"
  // 꼴로 지지 이름·점수가 새어 나왔다(v4.16 '사주 용어·점수 숫자 없음'과 정면충돌). mine·personal은 호환용으로 남기되 늘 null
  const mine: string | null = null;
  const personalOut: FortuneBrief["personal"] = null;

  const [y, m, d] = input.date.split("-").map(Number) as [number, number, number];
  const term = solarTermOf(input.date);
  const solarTerm = term.label;
  const allowedNumbers = extractNumbers([...facts, ...caveats, ...areas.map((a) => a.why), solarTerm, String(y), String(m), String(d)]);
  const withContext = hasContextFact(facts);
  const ang = angleOf(core, input.band);
  const names = namesFromCore(core);

  // 최근: 날짜 내림차순. 태그는 7일, 제목은 14일, 첫 문장·vote는 3일
  const recentAll = [...(input.recent ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const within = (days: number) => recentAll.filter((r) => daySeed(input.date) - daySeed(r.date) <= days);
  const tagged = within(7).filter((r) => r.tags).map((r) => ({ date: r.date, tags: r.tags! }));
  const recentLines = within(7).filter((r) => r.lines?.length).map((r) => ({ date: r.date, lines: r.lines! }));
  const avoid: FortuneBrief["avoid"] = {
    tags: tagged,
    headlines: within(14).map((r) => r.headline),
    scenes: [...new Set(tagged.map((t) => t.tags.장면).filter(Boolean))],
    ...(recentLines.length ? { lines: recentLines } : {}),
  };
  const recentTagText = tagged.map((t) => `${t.tags.주제} ${t.tags.상황} ${t.tags.감정}`).join(" ");
  const recentLineList = recentLines.flatMap((r) => r.lines);

  // 내부 판단: 오늘 기운 둘(같으면 하나)의 표현 후보 — 최근 7일 태그와 같은 뜻인 표현은 뺀다 (10항: 같은 흐름이 반복되면 장면을 바꾼다)
  const parts: { tg: typeof core.dayLuck.stem }[] = core.dayLuck.stem.tenGod === core.dayLuck.branch.tenGod ? [{ tg: core.dayLuck.stem }] : [{ tg: core.dayLuck.stem }, { tg: core.dayLuck.branch }];
  const tenGods: InsideTenGod[] = parts.map(({ tg }) => {
    const read = readOf(tg.label, core.dayLuck.method);
    const pool = TEN_GOD_EXPRESSIONS[tg.tenGod];
    const all = [...pool.경향, ...(read === "과함" ? pool.과할때 : read === "활용" ? pool.활용 : [])];
    // 3차 말뭉치(2026-10-24): 태그만 보니 "평소라면 지나쳤을 할인·제안" 문장이 4편에 그대로 옮겨졌다 — 최근 7일 본문 문장과 어간 3개 이상 겹치는 표현도 뺀다
    const fresh = all.filter((e) => !sharesMeaning(e, recentTagText) && !recentLineList.some((line) => sharesMeaning(e, line, 3)));
    const list = fresh.length >= 3 ? fresh : all;
    // 날짜로 돌려 순서를 바꾼다 — 첫 후보가 늘 같지 않게
    const start = seed % list.length;
    const rotated = [...list.slice(start), ...list.slice(0, start)];
    return { name: tg.tenGod, meaning: TEN_GOD_THEME[tg.tenGod], role: tg.label, read, expressions: rotated };
  });
  const contextLines = [
    ...(names.month ? [`이달: ${names.month.verdict}${core.context.wolun?.clash ? ", 오늘과 어긋남" : ""}`] : []),
    ...(core.context.seun.판정 ? [`올해: ${core.context.seun.판정}`] : []),
    ...facts.filter((f) => CONTEXT_FACT_RE.test(f)),
  ];
  const inside: FortuneBrief["inside"] = {
    tenGods,
    fit: names.fit,
    need: names.need ? `${names.need.el}(${names.need.power})` : null,
    facts,
    context: contextLines,
    direction: BAND_DIRECTION[input.band],
  };

  return {
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일`, solarTerm, useSolarTerm: term.isTermDay, solarTermName: term.name, tenGods: names.tenGods, elements: names.elements, fit: names.fit },
    me: { need: names.need?.label ?? null },
    month: names.month,
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
    angle: ang.angle,
    focusArea: ang.focus ? AREA_WORD[ang.focus] : null,
    inside,
    avoid,
    recent: within(3),
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
      headline: "20자 안, 오늘 체감할 내용 한 구절('미뤄 둔 일을 하나씩 끝내기 좋은 날'). 사주 이론·기운·실속·신호 같은 말 금지. avoid.headlines(최근 14일)와 뜻이 같으면 다른 각도로",
      body: "4~7문장, 2~3문단(빈 줄로 나눔). 먼저 inside로 오늘 생활 변화 후보 3~5개를 뽑고 핵심 하나를 고른 뒤(판단 칸), 고른 구조(A~E)로 그 핵심이 마음·행동·상황으로 어떻게 나타나는지와 조언을 쓴다. 십신·오행 이름, '맞는 편·모자란·넉넉한·실속·기운이 거든다' 같은 판정 문장은 쓰지 않는다 — 결과만. 둘째 기운은 첫째를 세게 하거나 누그러뜨리거나 주의점을 만들 때만. 이달·올해 운은 오늘 행동을 바꿀 때만 한 번 녹이기. 같은 성격이 두 번 온 날은 '겹친다' 대신 '아주 강하다/세다'로",
      areas: areas.length
        ? `areas는 입력 ${areas.length}개 가운데 오늘 핵심에 맞는 0~3개만 골라 같은 순서로(area·period 그대로, 나머지는 빼기). 각 line은 오늘 행동으로 1문장. 본문 문장을 되풀이하지 않기`
        : "areas는 빈 배열 []",
      doDont: "do(하면)와 dont(피해요)는 각각 1문장, 구체적 행동. 본문 문장을 되풀이하지 않기. '~해요/~않아요' 꼴",
      numbers: "숫자는 allowedNumbers에 있는 것만. 사실에 없는 숫자·사건·시간·금액을 만들지 않기. 점수는 화면에 있으니 글에 쓰지 않기 (\"N점\", \"N점 만점\" 금지)",
      mine: "내 기록 이야기를 하지 않기 (기록했다는 말, 평균, 횟수, 'N번·N점' 모두 금지 — 내 기록 숫자는 카드가 따로 보여 준다)",
      scene: term.isTermDay
        ? `오늘은 ${input.weekday}, ${term.name}${batchim(term.name) ? "이" : "가"} 시작하는 날. 절기 이름은 한 번만 써도 되고, 요일도 한 번만. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지. avoid.scenes(최근 7일 장면)는 쓰지 않기`
        : `오늘은 ${input.weekday}. 절기 이름(${term.name})은 쓰지 않기. 요일은 꼭 필요할 때만 한 번. 직장·회사 장면(거래처·제안서·회의·출근·상사)은 쓰지 않기. "특별한·남다른·다른 날과 달리·차별" 금지. avoid.scenes(최근 7일 장면)는 쓰지 않기`,
      context: `${names.month ? `이달 운(${names.month.verdict})은 오늘 행동을 바꿀 때만 본문에 한 문장으로 녹이고, 같은 방향이면 말하지 않기. ` : ""}${withContext
        ? "facts에 올해·10년 단위 운 문장이 있는 날이니 오늘 행동을 바꿀 때만 한 번 생활어로 넣기 (없는 운은 말하지 않기)"
        : "facts에 올해·10년 단위 운 문장이 없으니 올해 운·10년 단위 운은 말하지 않기"}`,
      terms: `십신 이름(${TEN_GOD_NAMES.join("·")})과 오행 이름(목·화·토·금·수)을 글 어디에도 쓰지 않기. 'A와 B'꼴 성격 이름(${ABSTRACT_LABELS.join("·")})도 그대로 쓰지 않기 — inside.tenGods[].expressions처럼 사람이 느끼거나 하는 말로. jargon의 낱말 금지. 비유("손에 붙어요·자리가 넓어져요·기운이 거들어요·실속이 채워져요·신호가 들어와요·돈 기운·흐름이 열려요")는 실제 느낌·행동으로 바꾸기`,
    },
  };
}

/** 모델에 보내는 user 메시지 본문. brief를 그대로 JSON으로. recent[].lines·tags(검사기용)는 떼고 보낸다 */
export function renderBrief(b: FortuneBrief): string {
  const { lines: _al, ...avoid } = b.avoid;
  return JSON.stringify({ ...b, avoid, recent: b.recent.map(({ lines: _l, tags: _t, ...r }) => r) });
}
