// 3단계 — 글의 재료(brief). 모델에게 가는 유일한 입력이고, 검사기(validate.ts)는 "brief에 없는 것이 글에 나왔는가"를 이 묶음으로 판단한다.
// 설계: docs/FORTUNE_V4.md "3단계 — 글".
// v4.16: 사주 이론(십신·오행·합충·판정)은 내부 판단으로만 넘기고 본문에는 쓰지 않는다.
// v4.19 (2026-10-31, ChatGPT 검토 반영): 무엇을 말할지는 plan.ts(코드)가 정하고, brief는 그 계획을 작가에게 건네는 얇은 묶음이다.
//   빠진 것: inside(이름·읽기·표현 후보 전부 — 계획의 핵심·보조로 대신), facts 중복(inside.facts와 facts가 같았다), 늘 null이던 personal·mine,
//   rules 9칸(SYSTEM·검사기와 겹쳤다), banned·jargon(SYSTEM에 한 번만), angle·focusArea, 의미 태그 avoid(태그 겹침 거부를 없앴다).
//   맥락(이달·올해·10년 운) 재료는 계획이 쓰기로 한 날에만 들어간다. renderWriterBrief가 모델에게 보내는 JSON이다.
import type { DayAngle } from "./angle";
import { BRANCH_META, ELEMENT_EN_TO_KO, STEM_META, type TenGod } from "@saju/engine";
import { GROUP_POWER, TEN_GOD_THEME } from "./base";
import { composeV5, type V5Material } from "./compose";
import { SCENES } from "./exemplars";
import { buildPlan, CONTEXT_FACT_RE, daySeed, hanjaToKo, READ_WORD, readOf, stripTenGodNames, type FortunePlan } from "./plan";
import { solarTermOf } from "./solarTerms";
import { areaStateOf, BANNED, batchim, namesFromCore } from "./text";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, CoreLuckPart, PersonalAdjustment, RoleLabel, StrengthKind, TenGodFamily } from "./types";

export { CONTEXT_FACT_RE, daySeed, hanjaToKo } from "./plan";

/** 사주 코어 content/validate.ts의 COMMON_BAN·HEALTH_BAN 복사. 하루 운세에서도 같은 선을 지킨다 */
export const CORE_BANNED = [
  "죽음", "사망", "단명", "요절", "이혼", "사별", "파산", "부도", "불륜", "암에", "암이", "수술", "교통사고", "사고를 당", "우울증", "공황", "자살",
  "반드시", "틀림없이", "무조건", "100% 확실", "백프로", "절대로", "팔자가 세", "팔자가 사나",
  "진단", "처방", "영양제", "검진", "치료", "질환", "병원", "복용", "증상", "약을 드", "건강검진",
];
/** v5: 넘지 말 선만 — 코어 금지 낱말에서 "무조건"을 뺀 것. 앱 주인이 확정한 글에 "무조건 떠맡지 마세요"가 있다(길흉 단정은 검사기 CERTAIN_RE가 따로 본다) */
export const V5_BANNED: readonly string[] = CORE_BANNED.filter((w) => w !== "무조건");
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
  /** v4.27: 이 사람의 일간(한자 한 글자). 작가 입력 '사주.나'에 쓴다. 없으면 일간 없이 신강약만 */
  dayMaster?: string;
  score10: number;
  band: "좋음" | "무난" | "주의";
  /** v4.8: 최근 이 사람의 운세 (14일). 없으면 빈 배열 */
  recent?: RecentFortune[];
  /** v4.26: 오늘의 각도 (angle.ts) */
  angle?: DayAngle | null;
  quietNotes?: ReadonlySet<string>;
  /** v5 (2026-11-14): 단락 사전으로 쓴다 — 글감은 compose.ts가 고르고 작가 입력은 v5.ts가 만든다. 없으면 v4.28 그대로 */
  v5?: boolean;
  /** 2026-11-17 기록 반영: 코드가 고른 기록 한 줄 (recall.ts recordLineOf). v5 글감에만 간다 */
  recordLine?: string | null;
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
  /** 2026-11-15: 그날 카드에 찍힌 인장 낱말 — 다음 날들이 같은 낱말을 되도록 피한다(seals.ts) */
  seals?: string[];
  /** 2026-11-17: 그날 글감으로 준 기록 한 줄의 key — 같은 줄을 7일에 한 번만 (recall.ts recordLineOf) */
  recordKey?: string;
}
type RecentRow = { fortune_date: string; content: { headline?: string; body?: string; bodySentences?: string[]; do?: string; dont?: string; areas?: { period?: string; line?: string }[]; areaNarratives?: { period?: string; text?: string }[]; stage?: string; seals?: { word?: string }[]; record?: { key?: string } } | null };
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
        ...(Array.isArray(c.seals) && c.seals.length ? { seals: c.seals.map((x) => String(x?.word ?? "")).filter(Boolean) } : {}),
        ...(c.record?.key ? { recordKey: String(c.record.key) } : {}),
      };
    });
}

// ---------- v4.27 (2026-11-10, 지적 원장 묶음 1 — 피드백/작가입력_재설계_2026-11-10.md 뿌리 4·5) ----------
// 작가에게 이 사람의 사주와 오늘 글자의 관계를 쉬운 말로 보낸다. 전에는 십신 이름·용신·신강약·두 기운 사이가 하나도 가지 않아
// "용신의 날인데 표현이 약하다", "겁재-정재의 관계도 설명해야", "재성 설명을 해야 하는데 관성 설명"이 나왔다.
// 십신·용신 이름은 입력에만 있다 — 글에 원어가 나오면 검사기(TEN_GOD_NAMES·JARGON)가 막는다. 글에는 그 뜻이 나온다.

/** 십신 뜻을 쉬운 말로. 앱 주인의 12-01~07 지적 문장에서 뽑았다 */
export const TEN_GOD_PLAIN: Record<TenGod, { 짧게: string; 뜻: string }> = {
  비견: { 짧게: "내 고집·주체성", 뜻: "나와 같은 기운. 어떤 일이든 주체적으로 내가 고르려는 마음, 내 주장과 고집, 혼자 해내려는 힘" },
  겁재: { 짧게: "경쟁·조바심", 뜻: "나와 같지만 음양이 다른 기운. 경쟁심과 조바심, 한 목표에 시간과 돈을 몰아 쓰려는 힘. 내 결과를 남이 가져가거나 칭찬이 작게 돌아올 수 있음" },
  식신: { 짧게: "여유·표현", 뜻: "내가 낳는 기운. 여유와 차분함, 말과 글로 유연하게 풀어내는 힘, 먹고 쉬고 만드는 일" },
  상관: { 짧게: "능력 발휘·직설", 뜻: "내가 낳되 밖으로 튀는 기운. 능력을 드러내고 빠르게 표현하는 힘, 말이 빠르고 직설적이 되기 쉬움" },
  편재: { 짧게: "벌이기·기회·큰돈", 뜻: "내가 다스리는 큰 돈과 기회. 여러 일을 벌여 바쁘게 움직이고 발이 넓어지는 힘, 사람에게 다가갈 용기, 재물의 오르내림" },
  정재: { 짧게: "정리·점검·확실한 성취", 뜻: "내가 다스리는 꾸준한 돈과 실속. 쌓인 일을 하나씩 정리하고 되돌아보는 힘, 재무 점검, 평소 해 온 것으로 인정받는 확실한 성취" },
  편관: { 짧게: "폭발적 처리·압박", 뜻: "나를 세게 누르는 기운. 미뤄 둔 일을 한꺼번에 폭발적으로 처리하는 힘, 압박감과 에너지 소모, 그만큼의 인정과 명예" },
  정관: { 짧게: "계획·순서·명예", 뜻: "나를 바르게 잡아 주는 기운. 계획과 순서대로 성실하게 해내는 힘, 내 역할을 보여 주려는 마음, 기대에 부응해야 한다는 부담" },
  편인: { 짧게: "혼자 생각·곱씹기", 뜻: "나를 낳되 치우친 기운. 혼자 생각이 길어지고 곱씹는 힘, 정보를 더 찾고 결정을 미루기 쉬움" },
  정인: { 짧게: "배움·쉼", 뜻: "나를 낳는 기운. 배우고 쉬며 받아들이는 힘, 기대고 싶은 마음, 몸을 돌봄" },
};
export const GROUP_PLAIN: Record<TenGodFamily, string> = { 비겁: "나·내 고집·경쟁", 식상: "표현·여유·능력", 재성: "돈·실속·성취", 관성: "책임·규칙·인정", 인성: "배움·쉼·생각" };
export const ROLE_PLAIN: Record<NonNullable<RoleLabel>, string> = {
  용: "내게 가장 필요한 기운(용신) — 오면 반갑고 그쪽 일이 잘 풀리기 쉬움",
  희: "필요한 기운을 돕는 쪽(희신) — 오면 좋음",
  한: "좋고 나쁨이 크지 않은 쪽(한신)",
  구: "지금 나와 맞지 않는 쪽(구신) — 오래 붙들면 지침",
  기: "내게 이미 넉넉한 기운(기신) — 더해지면 과해짐",
};
const STRENGTH_PLAIN: Record<StrengthKind, string> = {
  신강: "힘이 센 편(신강)이라 내 쪽 기운(내 고집·경쟁)이 이미 넉넉함",
  신약: "힘이 약한 편(신약)이라 나를 돕는 기운이 반가움",
  중화: "힘이 고른 편(중화)이라 오늘 글자의 성격이 그대로 드러남",
};
const EL_PLAIN: Record<string, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };
const SHENG: Record<TenGodFamily, TenGodFamily> = { 비겁: "식상", 식상: "재성", 재성: "관성", 관성: "인성", 인성: "비겁" };
const KE: Record<TenGodFamily, TenGodFamily> = { 비겁: "재성", 식상: "관성", 재성: "인성", 관성: "비겁", 인성: "식상" };
const POS_LIFE: Record<"연" | "월" | "일" | "시", string> = { 연: "오래된 인연·바깥", 월: "집안·일터·부모", 일: "나와 가장 가까운 사람", 시: "앞으로의 계획·자녀" };
const elKo = (ch: string): string => { const m = STEM_META[ch] ?? BRANCH_META[ch]; return m ? ELEMENT_EN_TO_KO[m.element] : "?"; };
const chKo = (ch: string): string => STEM_META[ch]?.ko ?? BRANCH_META[ch]?.ko ?? ch;
/** 조사: 받침 있으면 a, 없으면 b */
const josa = (w: string, a: string, b: string): string => (batchim(w) ? a : b);

/** 두 기운 그룹 사이(생·극·같음)를 쉬운 말로. a가 앞(핵심), b가 뒤. 이름은 짧은 뜻("경쟁·조바심") */
export function groupRelation(a: TenGodFamily, b: TenGodFamily, aName: string, bName: string): string {
  const A = `'${aName}'`, B = `'${bName}'`;
  if (a === b) return `${A}${josa(aName, "과", "와")} ${B}${josa(bName, "은", "는")} 같은 쪽 기운이라 겹쳐서 더 세짐`;
  if (SHENG[a] === b) return `${A}의 힘이 ${B} 쪽으로 흘러가는 사이 — ${A}${josa(aName, "이", "가")} 세면 ${B}${josa(bName, "으로", "로")} 풀어 쓰는 길이 있음`;
  if (SHENG[b] === a) return `${B}${josa(bName, "이", "가")} ${A}에 힘을 보태는 사이 — ${B}${josa(bName, "을", "를")} 쓰면 ${A}${josa(aName, "이", "가")} 더 살아남`;
  if (KE[a] === b) return `${A}${josa(aName, "이", "가")} ${B}${josa(bName, "을", "를")} 누르는 사이 — ${A}${josa(aName, "이", "가")} 세질수록 ${B} 쪽이 깎이기 쉬움`;
  return `${B}${josa(bName, "이", "가")} ${A}${josa(aName, "을", "를")} 누르는 사이 — ${B}${josa(bName, "이", "가")} ${A}${josa(aName, "을", "를")} 잡아 주거나 억누름`;
}

export interface SajuPart { 자리: "천간" | "지지"; 글자: string; 십신: TenGod; 뜻: string; 역할: string; 오늘: string; 이사람에게?: string }
export interface SajuBlock {
  나: string;
  필요한것: string | null;
  오늘글자: SajuPart[];
  /** 오늘 천간·지지 두 기운 사이 (핵심이 앞) */
  두기운사이: string;
  /** 오늘 글자 가운데 필요한 기운(용신 그룹)이 아닌 것과 필요한 기운 사이 */
  필요한것과의사이: string[];
  /** 오늘 지지가 내 원국 지지와 맺는 충·합·복음 */
  닿는자리: string[];
}

export function sajuBlockOf(core: CoreFortune, plan: FortunePlan, dayMaster?: string): SajuBlock {
  const kind = core.chartType?.신강약;
  const me = dayMaster && STEM_META[dayMaster] ? `${chKo(dayMaster)}(${EL_PLAIN[elKo(dayMaster)] ?? elKo(dayMaster)}) 일간. ` : "";
  const 나 = `${me}${kind ? STRENGTH_PLAIN[kind] : "힘의 세고 약함은 단정하지 않음"}`;
  const need = core.need ?? null;
  const 필요한것 = need ? `'${GROUP_PLAIN[need.그룹]}'(${need.그룹}, ${EL_PLAIN[need.오행] ?? need.오행}) 쪽이 내게 모자라 가장 필요함(용신) — ${GROUP_POWER[need.그룹]}` : null;
  const noteOf = (which: "천간" | "지지"): string | null =>
    plan.core.part === which ? plan.core.typeNote : plan.support?.kind === "기운" && plan.support.part.part === which ? plan.support.part.typeNote : null;
  const partOf = (p: CoreLuckPart, which: "천간" | "지지"): SajuPart => {
    const note = noteOf(which);
    return {
      자리: which, 글자: `${chKo(p.char)}(${EL_PLAIN[elKo(p.char)] ?? elKo(p.char)})`, 십신: p.tenGod, 뜻: TEN_GOD_PLAIN[p.tenGod].뜻,
      역할: p.label ? ROLE_PLAIN[p.label] : "좋고 나쁨은 단정하지 않음(태어난 시간 모름)",
      오늘: READ_WORD[readOf(p.label, core.dayLuck.method)],
      ...(note ? { 이사람에게: note } : {}),
    };
  };
  const { stem, branch } = core.dayLuck;
  const coreIsStem = plan.core.part === "천간";
  const [a, b] = coreIsStem ? [stem, branch] : [branch, stem];
  const name = (p: CoreLuckPart) => TEN_GOD_PLAIN[p.tenGod].짧게;
  const 두기운사이 = a.tenGod === b.tenGod
    ? `'${name(a)}'(${a.tenGod})이 겹으로 와서 그 성격이 하루 내내 또렷함`
    : `${groupRelation(a.family, b.family, name(a), name(b))} (${a.tenGod}→${b.tenGod})`;
  const 필요한것과의사이: string[] = [];
  if (need) for (const p of [a, b]) {
    if (p.family === need.그룹) continue;
    if (필요한것과의사이.some((x) => x.startsWith(`'${name(p)}'`))) continue;
    필요한것과의사이.push(`${groupRelation(p.family, need.그룹, name(p), GROUP_PLAIN[need.그룹])} (${p.tenGod}↔내게 필요한 ${need.그룹})`);
  }
  const todayBranch = chKo(branch.char);
  const 닿는자리 = core.relations.hits.map((h) => {
    if ((h.kind === "충" || h.kind === "복음") && h.fact) return hanjaToKo(h.fact);
    if (h.kind === "충") return `오늘 지지 ${todayBranch}${josa(todayBranch, "이", "가")} 내 ${h.pos}지와 부딪침(충) — ${POS_LIFE[h.pos]} 쪽 일이 흔들리기 쉬움`;
    if (h.kind === "복음") return `오늘 지지 ${todayBranch}${josa(todayBranch, "이", "가")} 내 ${h.pos}지와 같은 글자(복음) — ${POS_LIFE[h.pos]} 쪽 일이 되풀이되기 쉬움`;
    return `오늘 지지 ${todayBranch}${josa(todayBranch, "이", "가")} 내 ${h.pos}지와 하나로 모임(${h.kind}) — ${POS_LIFE[h.pos]} 쪽 사람·일과 호흡이 맞거나 묶이기 쉬움`;
  });
  return { 나, 필요한것, 오늘글자: [partOf(stem, "천간"), partOf(branch, "지지")], 두기운사이, 필요한것과의사이, 닿는자리 };
}

export interface FortuneBrief {
  /** 코드가 고른 오늘의 내용 (plan.ts) */
  plan: FortunePlan;
  /** v4.27: 이 사람의 사주와 오늘 글자의 관계 (쉬운 말) */
  saju: SajuBlock;
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
  areas: FortunePlan["areas"];
  caveats: string[];
  allowedNumbers: number[];
  /** 검사기용 (SYSTEM에 한 번 실려 있어 모델에게 다시 보내지 않는다) */
  banned: readonly string[];
  jargon: readonly string[];
  /** 최근 3일 (첫 문장·제목 겹침·"아니에요") */
  recent: RecentFortune[];
  /** 최근 제목(14일 — 완전히 같으면 수리)과 7일 본문 문장(검사기용) */
  avoid: { headlines: string[]; lines?: { date: string; lines: string[] }[]; actions?: { date: string; lines: string[] }[] };
  /** v5: 단락 사전에서 고른 오늘의 글감. 있으면 작가 입력·지시·검사기가 v5 쪽으로 간다 */
  v5?: V5Material;
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
  const plan = buildPlan({ core, personal: input.personal, date: input.date, band: input.band, recent: input.recent, angle: input.angle, quietNotes: input.quietNotes });
  const facts = core.facts.map(plainFact);
  const caveats = core.caveats.map(hanjaToKo);
  const term = solarTermOf(input.date);
  const names = namesFromCore(core);
  const hasMonth = plan.context.some((c) => c.startsWith("이달 운"));
  // v4.21 (ChatGPT 3차 10항): 날짜·절기 날수는 작가에게 보내지 않으니 숫자 허용 목록에서도 뺀다 — 계획(보조·맥락·참고)에 실린 숫자만
  const shown = [plan.support && plan.support.kind !== "기운" ? plan.support.text : "", ...plan.context, ...caveats];

  const recentAll = [...(input.recent ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const within = (days: number) => recentAll.filter((r) => daySeed(input.date) - daySeed(r.date) <= days);
  const recentLines = within(7).filter((r) => r.lines?.length).map((r) => ({ date: r.date, lines: r.lines! }));
  const recentActions = within(3).filter((r) => r.actions?.length).map((r) => ({ date: r.date, lines: r.actions! }));

  return {
    plan,
    today: { date: input.date, weekday: input.weekday, ganji: `${today.ko}일`, solarTerm: term.label, useSolarTerm: term.isTermDay, solarTermName: term.name },
    score: { value: input.score10, band: input.band, word: BAND_WORD[input.band] },
    // v4.27: 세 단계 모두 해결법과 응원으로 닫는다 (주의 날 "기대를 낮춰 주는 위로"가 부정만 늘어놓는 글을 불렀다 — 지적 원장 뿌리 3)
    tone: input.band === "좋음" ? "밝고 확신 있게. 좋은 점을 앞세우되 과장하지 않기" : input.band === "주의" ? "차분하고 진지하게. 조심할 점은 분명히 말하되 그 기운을 쓸 자리와 해결법을 대고 응원으로 닫기" : "담담하게. 좋은 점을 더 부각하고 조심할 점은 해결법과 함께",
    saju: sajuBlockOf(core, plan, input.dayMaster),
    context: plan.context,
    month: hasMonth ? names.month : null,
    facts,
    areas: plan.areas,
    caveats,
    allowedNumbers: extractNumbers(shown),
    // v5: 문체 금지어(text.ts BANNED)는 쓰지 않는다 — 넘지 말 선(코어 금지 낱말)과 사주 원어만 막는다
    banned: input.v5 ? V5_BANNED : BANNED_ALL,
    jargon: JARGON,
    recent: within(3),
    avoid: { headlines: within(14).map((r) => r.headline), ...(recentLines.length ? { lines: recentLines } : {}), ...(recentActions.length ? { actions: recentActions } : {}) },
    ...(input.v5 ? { v5: composeV5({ core, band: input.band, date: input.date, recentEndings: within(7).flatMap((r) => r.lines?.slice(-1) ?? []), recordLine: input.recordLine ?? null }) } : {}),
  };
}

/** v4.28: 읽기 → 짧은 까닭 말 */
const READ_SHORT: Record<string, string> = {
  활용: "오늘 도움이 되는 쪽",
  보통: "좋고 나쁨 없이 평소대로 나오는 쪽",
  과함: "세지는 날 — 내게 이미 넉넉한 쪽이라 과해지기 쉬움",
  보류: "좋고 나쁨은 단정하지 않음(태어난 시간 모름)",
};
/** v4.28: 사주 칸 → 작가가 글에 한두 번만 쓸 '까닭' 두세 줄 */
export function reasonsOf(b: FortuneBrief): string[] {
  const p = b.plan;
  const s = b.saju;
  const out: string[] = [];
  const name = (x: FortunePlan["core"]) => `${TEN_GOD_PLAIN[x.tenGod].짧게}(${x.tenGod})`;
  const same = p.support?.kind === "기운" ? false : s.오늘글자[0]!.십신 === s.오늘글자[1]!.십신;
  const coreLine = `${name(p.core)}${same ? "이 겹쳐 하루 내내 또렷함 — " : "이 "}${same ? READ_SHORT[p.core.read]! : READ_SHORT[p.core.read]!}${p.core.label === "용" ? " — 내게 가장 필요한 쪽" : ""}${p.core.typeNote ? ` — ${p.core.typeNote}` : ""}`;
  out.push(coreLine);
  if (p.support?.kind === "기운") {
    const sp = p.support.part;
    out.push(`${name(sp)}은 ${READ_SHORT[sp.read]}${sp.label === "용" ? " — 내게 가장 필요한 쪽" : ""}${sp.typeNote ? ` — ${sp.typeNote}` : ""}`);
    if ((p.core.read === "과함" || sp.read === "과함") && s.두기운사이) out.push(s.두기운사이.replace(/ \([^()]*→[^()]*\)$/, ""));
  } else if (p.support) out.push(p.support.text);
  if (s.필요한것과의사이[0] && (p.core.read === "과함" || (p.support?.kind === "기운" && p.support.part.read === "과함"))) out.push(s.필요한것과의사이[0].replace(/ \([^()]*↔[^()]*\)$/, ""));
  for (const r of s.닿는자리) if (!out.includes(r)) out.push(r);
  return out.slice(0, 5);
}

/** 모델(작가)에게 보내는 user 메시지 본문 — v4.28: 본보기(exemplars.ts)와 같은 꼴. 설명 대신 까닭 두세 줄과 장면 명사 */
export function renderBrief(b: FortuneBrief): string {
  const p = b.plan;
  const av = p.avoid;
  const recentDo = (b.avoid.actions ?? []).flatMap((r) => r.lines.slice(0, 1));
  const recentEnd = b.recent.flatMap((r) => r.lines?.slice(-1) ?? []);
  const avoid = {
    ...(av.headlines.length ? { 최근제목: av.headlines } : {}),
    ...(av.obvious.length ? { 뻔했던조언: av.obvious } : {}),
    ...(recentDo.length ? { 최근하면: recentDo } : {}),
    ...(recentEnd.length ? { 최근마무리: recentEnd } : {}),
  };
  const seed = daySeed(b.today.date);
  const rot = <T,>(xs: readonly T[], n: number, k: number): T[] => { const start = xs.length ? k % xs.length : 0; return [...xs.slice(start), ...xs.slice(0, start)].slice(0, n); };
  const coreScenes = SCENES[p.core.tenGod];
  const sup = p.support?.kind === "기운" ? SCENES[p.support.part.tenGod] : null;
  const 장면 = [...rot(coreScenes.장면, 4, seed), ...(sup ? rot(sup.장면, 2, seed + 1) : [])];
  const 비유 = [...new Set([...coreScenes.비유, ...(sup ? sup.비유 : [])])];
  const 나 = `${b.saju.나}${b.saju.필요한것 ? ` — 내게 필요한 건 ${b.saju.필요한것.split(" 쪽이")[0]}` : ""}`;
  return JSON.stringify({
    ...(b.today.useSolarTerm ? { 절기첫날: b.today.solarTermName } : {}),
    단계: `${b.score.band}(${b.score.word})`,
    말투: b.tone,
    나,
    오늘글자: b.today.ganji.replace(/일$/, ""),
    까닭: reasonsOf(b),
    장면,
    ...(비유.length ? { 비유 } : {}),
    영역: p.areas.map((a) => `${a.word}${a.signal} (${areaStateOf(a.area, a.signal as "↑" | "↓")}${a.period !== "오늘" ? `, ${a.period}` : ""})`),
    ...(p.angle ? { 오늘의각도: { 종류: p.angle.kind, 이야기: p.angle.story } } : {}),
    ...(p.context.length ? { 맥락: p.context } : {}),
    ...(Object.keys(avoid).length ? { 피할것: avoid } : {}),
    숫자: b.allowedNumbers,
    ...(b.caveats.length ? { 참고: b.caveats } : {}),
  });
}
