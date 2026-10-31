// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 설계: docs/FORTUNE_V4.md "3단계 — 글".
// v4.16: 사주 이론(십신·오행·합충·판정)은 내부 판단으로만 넘기고 본문에는 쓰지 않는다.
// v4.19 (2026-10-31, ChatGPT 검토 반영): 무엇을 말할지는 plan.ts(코드)가 정하고, brief는 그 계획을 작가에게 건네는 얇은 묶음이다.
//   빠진 것: inside(이름·읽기·표현 후보 전부 — 계획의 핵심·보조로 대신), facts 중복(inside.facts와 facts가 같았다), 늘 null이던 personal·mine,
//   rules 9칸(SYSTEM·검사기와 겹쳤다), banned·jargon(SYSTEM에 한 번만), angle·focusArea, 의미 태그 avoid(태그 겹침 거부를 없앴다).
//   맥락(이달·올해·10년 운) 재료는 계획이 쓰기로 한 날에만 들어간다. renderWriterBrief가 모델에게 보내는 JSON이다.
import { TEN_GOD_THEME } from "./base";
import { buildPlan, CONTEXT_FACT_RE, daySeed, hanjaToKo, READ_WORD, stripTenGodNames, type FortunePlan } from "./plan";
import { solarTermOf } from "./solarTerms";
import { BANNED, namesFromCore } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, PersonalAdjustment } from "./types";

export { BAND_DIRECTION, CONTEXT_FACT_RE, daySeed, hanjaToKo } from "./plan";

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
  /** v4.8: 최근 이 사람의 운세 (14일). 없으면 빈 배열 */
  recent?: RecentFortune[];
}

export const hasContextFact = (facts: readonly string[]): boolean => facts.some((f) => CONTEXT_FACT_RE.test(f));

/** v4.5: 본문에 그대로 쓰면 추상적으로 읽히는 성격 이름("경쟁과 추진" 같은 'A과 B' 꼴). 본문에서 그대로 쓰면 탈락 */
export const ABSTRACT_LABELS: readonly string[] = Object.values(TEN_GOD_THEME).filter((t) => /[과와] /.test(t));

/** v4.6: 오늘의 짜임. change = 운이 바뀌거나 내 사주와 부딪히는 날 · focus = 한 생활 영역에 신호가 뚜렷한 날 · calm = 큰 신호 없는 날. v4.19: 검수(review.ts)만 쓴다 */
export type FortuneAngle = "change" | "focus" | "calm";
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
  /** 첫 두 문장 */
  start: string;
  /** v4.9: 그날 "맞아요"(1)·"아니에요"(-1). -1이면 오늘은 그 주제를 앞세우지 않는다 */
  vote?: 1 | -1;
  /** v4.20: "아니에요"의 이유 — content(내용이 안 맞음)·obvious(뻔함)·awkward(문장이 어색함). 이유마다 쓰는 곳이 다르다(plan.avoidFromRecent) */
  voteReason?: "content" | "obvious" | "awkward";
  /** v4.11: 그날의 이달·올해 영역 줄 */
  areas?: string[];
  /** v4.15: 그날 사례 무대 이름 (옛 캐시 호환) */
  stage?: string;
  /** 그날 본문 문장 전부 — 검사기·계획(최근 표현)만 본다 */
  lines?: string[];
  /** v4.19: 그날 하면·피해요 — 계획이 최근 행동 낱말을 뽑는다 */
  actions?: string[];
}
type RecentRow = { fortune_date: string; content: { headline?: string; body?: string; bodySentences?: string[]; do?: string; dont?: string; areas?: { period?: string; line?: string }[]; areaNarratives?: { period?: string; text?: string }[]; stage?: string } | null };
export function recentFromRows(rows: RecentRow[]): RecentFortune[] {
  return rows
    .filter((r) => r.content?.headline && r.content?.body)
    .map((r) => {
      const c = r.content!;
      const areas = [
        ...(c.areaNarratives ?? []).filter((a) => a && a.period !== "오늘" && a.text).map((a) => String(a.text)),
        ...(c.areaNarratives ? [] : (c.areas ?? []).filter((a) => a && a.period !== "오늘" && a.line).map((a) => String(a.line))),
      ];
      const lines = Array.isArray(c.bodySentences) && c.bodySentences.length ? c.bodySentences.map(String) : c.body!.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      const actions = [c.do, c.dont].filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      return {
        date: r.fortune_date,
        headline: c.headline!,
        start: lines.slice(0, 2).join(" "),
        ...(areas.length ? { areas } : {}),
        ...(c.stage ? { stage: c.stage } : {}),
        lines,
        ...(actions.length ? { actions } : {}),
      };
    });
}

export interface FortuneBrief {
  /** 코드가 고른 오늘의 내용 (plan.ts) */
  plan: FortunePlan;
  today: { date: string; weekday: string; ganji: string; solarTerm: string; useSolarTerm: boolean; solarTermName: string };
  score: { value: number; band: string; word: string };
  tone: string;
  /** 맥락 문장 — 계획이 쓰기로 한 날에만(아니면 빈 배열). 검사기는 여기에 있는 운만 글에 나올 수 있게 한다 */
  context: string[];
  /** 이달 운 이름·판정. 맥락에 이달 문장이 있는 날에만 (아니면 null — 검사기가 이달 운 언급을 막는다) */
  month: { ganji: string; elements: string; verdict: string; line: string } | null;
  /** 엔진 사실 문장(한글) — 검사기·검수용. 모델에게 그대로 보내지 않는다 (핵심·보조·맥락 문장으로 골라 보낸다) */
  facts: string[];
  /** 글로 풀 영역 (계획 그대로, 최대 2) */
  areas: { period: AreaPeriod; area: AreaName; word: string; signal: AreaSignal }[];
  caveats: string[];
  allowedNumbers: number[];
  /** 검사기용 (SYSTEM에 한 번 실려 있어 모델에게 다시 보내지 않는다) */
  banned: readonly string[];
  jargon: readonly string[];
  /** 최근 3일 (첫 문장·제목 겹침·"아니에요") */
  recent: RecentFortune[];
  /** 최근 제목(14일 — 완전히 같으면 수리)과 7일 본문 문장(검사기용) */
  avoid: { headlines: string[]; lines?: { date: string; lines: string[] }[] };
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
  const { core, today } = input;
  const plan = buildPlan({ core, personal: input.personal, date: input.date, band: input.band, recent: input.recent });
  const facts = core.facts.map(plainFact);
  const caveats = core.caveats.map(hanjaToKo);
  const [y, m, d] = input.date.split("-").map(Number) as [number, number, number];
  const term = solarTermOf(input.date);
  const names = namesFromCore(core);
  const hasMonth = plan.context.some((c) => c.startsWith("이달 운"));
  const shown = [plan.support && plan.support.kind !== "기운" ? plan.support.text : "", ...plan.context, ...caveats, term.label, String(y), String(m), String(d)];

  const recentAll = [...(input.recent ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const within = (days: number) => recentAll.filter((r) => daySeed(input.date) - daySeed(r.date) <= days);
  const recentLines = within(7).filter((r) => r.lines?.length).map((r) => ({ date: r.date, lines: r.lines! }));

  return {
    plan,
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일`, solarTerm: term.label, useSolarTerm: term.isTermDay, solarTermName: term.name },
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
    tone: input.band === "좋음" ? "경쾌하고 가볍게, 들뜨지 않게" : input.band === "주의" ? "차분하게, 기대를 낮춰 주는 위로로" : "담담하게, 일상의 말투로",
    context: plan.context,
    month: hasMonth ? names.month : null,
    facts,
    areas: plan.areas,
    caveats,
    allowedNumbers: extractNumbers(shown),
    banned: BANNED_ALL,
    jargon: JARGON,
    recent: within(3),
    avoid: { headlines: within(14).map((r) => r.headline), ...(recentLines.length ? { lines: recentLines } : {}) },
  };
}

/** 모델(작가)에게 보내는 user 메시지 본문 — 계획을 한국어 칸 이름으로. 검사기용 칸(facts·banned·jargon·recent 문장)은 보내지 않는다 */
export function renderBrief(b: FortuneBrief): string {
  const p = b.plan;
  // 사실 문장("내게 모자란 … 채워져요")은 판정 말투라 보내지 않는다 — 읽기(오늘)와 표현 후보로 충분하다 (v4.18까지 판정 문장이 본문에 새던 1위 경로)
  const part = (x: FortunePlan["core"]) => ({ 뜻: x.meaning, 오늘: READ_WORD[x.read], 표현: x.expressions });
  const av = p.avoid;
  const avoid = {
    ...(av.scenes.length ? { 장면: av.scenes } : {}),
    ...(av.verbs.length ? { 동작: av.verbs } : {}),
    ...(av.openers.length ? { 첫어절: av.openers } : {}),
    ...(av.headlineEndings.length ? { 제목끝: av.headlineEndings } : {}),
    ...(av.headlines.length ? { 최근제목: av.headlines } : {}),
    ...(av.voteDown.length ? { 아니에요: av.voteDown } : {}),
    ...(av.obvious.length ? { 뻔했던조언: av.obvious } : {}),
  };
  return JSON.stringify({
    // v4.20: 날짜·요일·절기는 보내지 않는다 — 받은 정보는 쓰려 들어 "토요일 하루가", "입동 첫날이니"가 붙었다. 절기 첫날에만 이름을 곁들일 거리로
    ...(b.today.useSolarTerm ? { 절기첫날: b.today.solarTermName } : {}),
    단계: `${b.score.band}(${b.score.word})`,
    말투: b.tone,
    방향: p.direction,
    핵심: part(p.core),
    ...(p.support ? { 보조: p.support.kind === "기운" ? part(p.support.part) : { 사실: stripTenGodNames(p.support.text) } } : {}),
    ...(p.context.length ? { 맥락: p.context } : {}),
    영역: p.areas.map((a) => ({ 영역: a.area, 말: a.word, 기간: a.period, 신호: a.signal })),
    ...(Object.keys(avoid).length ? { 피할것: avoid } : {}),
    숫자: b.allowedNumbers,
    ...(b.caveats.length ? { 참고: b.caveats } : {}),
  });
}
