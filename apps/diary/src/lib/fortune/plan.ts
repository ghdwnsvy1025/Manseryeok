// v4.19 (2026-10-31, ChatGPT 검토 반영) — 오늘 "무엇을 말할지"를 코드가 고른다. 모델은 이 계획을 사람 말로 쓰기만 한다.
//   원칙: 사주 계산은 코드가 하고, 오늘 무엇을 말할지도 코드가 고르고, AI는 그걸 사람 말처럼 잘 쓰는 데만 쓴다.
//   v4.16~4.18은 모델이 후보 3~5 → 핵심 → 이유 → 둘째 기운 → 운 맥락 → 구조 A~E → 태그 8칸을 먼저 정했다. 그 판단이 날마다 흔들렸고
//   (같은 라벨의 날도 핵심이 달라짐), 출력 토큰의 절반이 판단·태그였다. 이제 그 자리를 이 파일이 맡는다:
//   - 핵심 1개: 일진 천간·지지 가운데 |코어 점수|가 큰 쪽 (같으면 천간). 그 기운의 뜻·읽기·사실 문장·생활 표현 후보 4개
//   - 보조 0~1개: 일·월 자리 충 > 다른 쪽 기운(|점수| ≥ 1) > 복음·다른 충 > 없음
//   - 맥락(이달·올해·10년 운): 운이 바뀌는 날·운↔일진 충인 날(core.facts에 그 문장이 있는 날), 또는 맥락 점수(ctx)를 빼면 밴드가 바뀌는 날만.
//     아니면 맥락 재료를 brief에 아예 넣지 않는다
//   - 글로 풀 영역 최대 2개(오늘 것을 코어 순서 = |합| 순으로 먼저. v4.21에서 ↑ 먼저 정렬과 밴드별 행동 방향을 뺐다)
//   - 최근 쓴 장면·동작·첫 어절·제목 끝맺음 — 같은 주제가 다시 나오는 것은 괜찮고, 표현 면(장면·행동·제목 꼴)만 돌린다
// 이 파일은 brief.ts를 부르지 않는다(brief.ts가 이 파일을 부른다). 공용 작은 함수(daySeed·hanjaToKo·맥락 정규식·밴드 방향)는 여기 두고 brief.ts가 다시 내보낸다.
import type { TenGod } from "@saju/engine";
import { TEN_GOD_THEME } from "./base";
import { AREA_WORD, toScore01 } from "./core";
import type { FortuneTags } from "./examples";
import { TEN_GOD_EXPRESSIONS } from "./expressions";
import { bandOf, toTenPoint } from "./personal";
import type { AreaName, AreaPeriod, AreaSignal, CoreFortune, CoreLuckPart, FortunePlanSummary, PersonalAdjustment, RoleLabel } from "./types";

// ---------- 공용 (brief.ts가 다시 내보낸다) ----------
const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥", S_KO = "갑을병정무기경신임계", B_KO = "자축인묘진사오미신유술해";
/** 한자 간지를 한글 읽기로 ("丙午" → "병오", "壬" → "임"). 글은 한글로만 쓰므로 brief에서 먼저 바꾼다 */
export function hanjaToKo(s: string): string {
  return [...s].map((ch) => (STEMS.includes(ch) ? S_KO[STEMS.indexOf(ch)]! : BRANCHES.includes(ch) ? B_KO[BRANCHES.indexOf(ch)]! : ch)).join("");
}
/** 날짜 → 고르는 수 (같은 날이면 늘 같다) */
export function daySeed(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
/** v4.4: facts 안의 맥락 문장(올해·이달·10년 단위 운). 바뀌는 날·충인 날에만 core.facts에 들어 있다 */
export const CONTEXT_FACT_RE = /^(올해 운|이달 운|지금 10년 단위 운)/;
/** v4.16 6항: 단계는 문장 톤과 조언 방향을 정하는 내부 정보였다.
 *  v4.20 P1: 구체 행동을 빼고 "말투 강도"만 남겼는데도 주의의 "범위를 줄이는 쪽으로"가 행동으로 읽혀 주의 87편 중 73편이 범위·벌이기·하나만으로 모였다.
 *  v4.21 (ChatGPT 3차 1항): 방향 칸을 없앤다. 얼마나 조심스럽게 말할지는 단계와 말투(brief.tone)가 정하고, 행동의 종류는 핵심·보조·영역의 뜻에서만 나온다 */

/** 십신 이름 괄호 "(겁재)"를 뗀다 — 모델에게 가는 사실 문장에 이름을 싣지 않는다 */
const TEN_GOD_PAREN_RE = /\((비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)\)/g;
export const stripTenGodNames = (s: string): string => s.replace(TEN_GOD_PAREN_RE, "");

/** 최근 운세 한 편 (brief.ts RecentFortune과 같은 모양 — 순환 import를 피해 필요한 칸만) */
interface RecentLike { date: string; headline: string; lines?: string[]; actions?: string[]; vote?: 1 | -1; voteReason?: "content" | "obvious" | "awkward" }

// ---------- 계획 ----------
export type PartRead = "활용" | "보통" | "과함" | "보류";
export interface PlanPart {
  part: "천간" | "지지";
  tenGod: TenGod;
  /** 성격 이름("경쟁과 추진") — 본문에 그대로 쓰지 않는다 */
  meaning: string;
  label: RoleLabel;
  read: PartRead;
  score: number;
  /** 코어 사실 문장(십신 이름 괄호를 뗀 것). 한신·용신 없음이면 null */
  fact: string | null;
  /** 오늘 고를 생활 표현 후보 (최근 문장과 겹치는 것을 뺀 뒤 날짜로 돌려 4개) */
  expressions: string[];
}
export type PlanSupport = { kind: "기운"; part: PlanPart; text: string } | { kind: "충" | "복음"; text: string };
export interface PlanArea { period: AreaPeriod; area: AreaName; word: string; signal: AreaSignal }
export interface PlanAvoid {
  /** 최근 7일 글에 나온 장면 낱말 */
  scenes: string[];
  /** 최근 3일 하면·피해요와 7일 본문에서 두 번 넘게 쓴 행동 낱말 */
  verbs: string[];
  /** 최근 7일 본문 첫 어절 */
  openers: string[];
  /** 최근 14일 제목에서 두 번 넘게 쓴 끝맺음 ("날", "날이에요") */
  headlineEndings: string[];
  /** 최근 7일 제목 */
  headlines: string[];
  /** 최근 3일 가운데 "아니에요"(이유: 내용이 안 맞음, 또는 이유 없음)를 누른 날의 제목 — 그 주제를 앞세우지 않는다 */
  voteDown: string[];
  /** v4.20: 최근 7일 가운데 "너무 뻔함"을 누른 날의 하면·피해요 — 그 조언을 다시 쓰지 않는다. "문장이 어색함"은 주제·조언 어느 쪽도 피하지 않는다(측정에만) */
  obvious: string[];
}
export interface FortunePlan {
  core: PlanPart;
  support: PlanSupport | null;
  includeContext: boolean;
  contextReason: "운이 바뀌거나 오늘과 어긋나는 날" | "운 맥락이 단계를 바꾸는 날" | null;
  /** 맥락 문장 (includeContext일 때만, 아니면 빈 배열) */
  context: string[];
  /** 글로 풀 영역 (최대 2) */
  areas: PlanArea[];
  avoid: PlanAvoid;
  /** 핵심이 본문에 들어갔는지 볼 어간 (검사기용) */
  coreStems: string[];
}

export interface PlanInput {
  core: CoreFortune;
  personal: PersonalAdjustment;
  date: string;
  band: "좋음" | "무난" | "주의";
  recent?: RecentLike[];
}

const readOf = (role: RoleLabel, method: CoreFortune["dayLuck"]["method"]): PartRead =>
  method === "용신 없음" || role === null ? "보류" : role === "용" || role === "희" ? "활용" : role === "한" ? "보통" : "과함";
/** v4.21 (ChatGPT 3차 2항): 작가에게 가는 내부 말은 자연스러움보다 뜻이 하나여야 한다. "지나치기 쉬운 쪽"은 "그냥 지나쳐 버리기 쉽다"로도 읽혀
 *  "그 마음이 쉽게 지나쳐지는 날"처럼 반대로 쓰였다(B 119편 중 3~4편) */
export const READ_WORD: Record<PartRead, string> = {
  활용: "이 성향이 오늘 도움이 되는 쪽으로 나타남",
  보통: "이 성향이 좋고 나쁨 없이 평소대로 나타남",
  과함: "이 성향이 필요 이상으로 세지기 쉬움",
  보류: "좋고 나쁨은 단정하지 않음(태어난 시간 모름)",
};

/** 낱말 어간(앞 두 글자) 집합. 흔한 말은 뺀다 */
const COMMON_STEMS = new Set(["오늘", "평소", "마음", "생각", "있어", "없어", "하고", "해요", "돼요", "보다", "쉬워", "커져", "싶어", "하기", "에서", "으로", "이나", "같은", "그런", "이런", "조금", "한번", "먼저", "많아", "편이", "쪽이", "내가", "내게", "나를", "남이", "남에",
  "것이", "것을", "것마", "것도", "싶은", "싶어", "들어", "일에", "일을", "일이", "사람", "좋아", "보여", "눈에", "새로", "없던", "가서", "생겨", "지나", "여기", "손이", "계획", "가볍", "하나", "해야", "때를", "말이", "말과", "평소", "이미", "더해", "쉽게", "지금", "자꾸", "제대", "그대"]);
export function stemSet(s: string): Set<string> {
  return new Set(s.replace(/[.,!?'"()·]/g, " ").split(/\s+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)).filter((w) => !COMMON_STEMS.has(w)));
}
function sharesStems(a: string, b: string, min: number): boolean {
  const sa = stemSet(a), sb = stemSet(b);
  let n = 0;
  for (const s of sa) if (sb.has(s)) n++;
  return n >= min;
}

/** 사실 문장 가운데 이 기운의 라벨 문장 ("'경쟁과 추진'(겁재) 쪽은 …") */
function factOf(core: CoreFortune, tg: TenGod): string | null {
  const head = `'${TEN_GOD_THEME[tg]}'(${tg}) 쪽은`;
  const f = core.facts.find((x) => x.startsWith(head));
  return f ? stripTenGodNames(hanjaToKo(f)) : null;
}

function partPlan(core: CoreFortune, p: CoreLuckPart, which: "천간" | "지지", seed: number, recentLines: string[]): PlanPart {
  const read = readOf(p.label, core.dayLuck.method);
  const pool = TEN_GOD_EXPRESSIONS[p.tenGod];
  const all = [...(read === "과함" ? pool.과할때 : read === "활용" ? pool.활용 : []), ...pool.경향];
  // 3차 말뭉치(2026-10-24): 표현 후보 문장이 여러 날에 그대로 옮겨졌다 — 최근 7일 본문 문장과 어간 3개 이상 겹치는 표현은 뺀다
  const fresh = all.filter((e) => !recentLines.some((line) => sharesStems(e, line, 3)));
  const list = fresh.length >= 3 ? fresh : all;
  const start = seed % list.length;
  const rotated = [...list.slice(start), ...list.slice(0, start)];
  return { part: which, tenGod: p.tenGod, meaning: TEN_GOD_THEME[p.tenGod], label: p.label, read, score: p.score, fact: factOf(core, p.tenGod), expressions: rotated.slice(0, 4) };
}

/** 최근 글에서 찾을 장면 낱말 (생활 장면). 표현만 돌리려는 것이라 넉넉하지 않아도 된다 */
export const SCENE_WORDS = [
  "답장", "메시지", "문자", "전화", "통화", "연락", "결제", "장바구니", "할인", "지출", "통장", "영수증", "일정", "약속", "달력", "산책", "운동", "청소", "빨래", "설거지",
  "장보기", "요리", "식사", "밥", "낮잠", "커피", "책상", "서랍", "옷장", "메모", "목록", "책", "공부", "선물", "부탁", "모임", "가족", "친구", "휴대폰", "알림", "사진", "택배",
] as const;
/** 최근 글에서 찾을 행동 낱말 (어간) */
export const VERB_WORDS = ["미뤄", "미루", "확인", "끝내", "마무리", "적어", "물어", "줄이", "줄여", "쉬어", "묵혀", "비우", "챙기", "챙겨", "보내", "거절", "나누", "맡기", "맡겨", "기다리", "멈추", "멈춰", "덜어", "걸어", "정해", "골라", "닫아", "넘기"] as const;

/** 제목 끝맺음: 마지막 어절 ("…좋은 날" → "날", "…날이에요" → "날이에요", "…하루" → "하루") */
export function headlineEnding(h: string): string {
  const w = h.trim().replace(/[.!?]+$/, "").split(/\s+/).at(-1) ?? "";
  return /날$/.test(w) ? "날" : /날이에요$/.test(w) ? "날이에요" : /요$/.test(w) ? "~요" : w;
}

export function avoidFromRecent(date: string, recent: readonly RecentLike[]): PlanAvoid {
  const sorted = [...recent].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const now = daySeed(date);
  const within = (days: number) => sorted.filter((r) => now - daySeed(r.date) <= days && now - daySeed(r.date) > 0);
  const d7 = within(7), d3 = within(3), d14 = within(14);
  const body7 = d7.flatMap((r) => r.lines ?? []);
  const text7 = [...body7, ...d7.flatMap((r) => r.actions ?? []), ...d7.map((r) => r.headline)].join(" ");
  const scenes = SCENE_WORDS.filter((w) => text7.includes(w));
  const act3 = d3.flatMap((r) => r.actions ?? []).join(" ");
  const bodyText = body7.join(" ");
  const verbs = VERB_WORDS.filter((w) => act3.includes(w) || bodyText.split(w).length - 1 >= 2);
  const openers = [...new Set(d7.map((r) => (r.lines?.[0] ?? "").split(/\s+/)[0] ?? "").filter((w) => w.length >= 2))];
  const endCount = new Map<string, number>();
  for (const r of d14) { const e = headlineEnding(r.headline); if (e) endCount.set(e, (endCount.get(e) ?? 0) + 1); }
  const headlineEndings = [...endCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([e]) => e);
  const voteDown = d3.filter((r) => r.vote === -1 && (r.voteReason === undefined || r.voteReason === "content")).map((r) => r.headline);
  const obvious = d7.filter((r) => r.vote === -1 && r.voteReason === "obvious").flatMap((r) => r.actions ?? []);
  return { scenes, verbs, openers, headlineEndings, headlines: d7.map((r) => r.headline), voteDown, obvious };
}

export function buildPlan(input: PlanInput): FortunePlan {
  const { core, band } = input;
  const seed = daySeed(input.date);
  const recentLines = (input.recent ?? []).filter((r) => seed - daySeed(r.date) <= 7).flatMap((r) => r.lines ?? []);
  const { stem, branch } = core.dayLuck;
  // 핵심: |점수| 큰 쪽, 같으면 천간
  const coreIsStem = Math.abs(stem.score) >= Math.abs(branch.score);
  const corePart = partPlan(core, coreIsStem ? stem : branch, coreIsStem ? "천간" : "지지", seed, recentLines);
  const other = coreIsStem ? branch : stem;

  // 보조: 일·월 자리 충 > 다른 쪽 기운(|점수| ≥ 1, 다른 십신) > 복음·다른 충 > 없음
  // v4.20: 관계 객체에 붙은 문장을 그대로 쓴다 (문장을 정규식으로 다시 찾지 않는다 — 충이 둘인 날 다른 자리 문장을 집었다)
  const clashFact = (pred: (pos: string) => boolean) => core.relations.hits.find((h) => h.kind === "충" && pred(h.pos) && h.fact)?.fact ?? null;
  let support: PlanSupport | null = null;
  const nearClash = clashFact((pos) => pos === "일" || pos === "월");
  if (nearClash) support = { kind: "충", text: nearClash };
  else if (other.tenGod !== corePart.tenGod && Math.abs(other.score) >= 1) {
    const part = partPlan(core, other, coreIsStem ? "지지" : "천간", seed + 1, recentLines);
    support = { kind: "기운", part: { ...part, expressions: part.expressions.slice(0, 2) }, text: part.fact ?? part.meaning };
  } else {
    const rep = core.relations.hits.find((h) => h.kind === "복음" && h.fact)?.fact ?? null;
    const farClash = clashFact(() => true);
    if (farClash) support = { kind: "충", text: farClash };
    else if (rep) support = { kind: "복음", text: rep };
  }

  // 맥락: 바뀌는 날·충인 날(facts에 맥락 문장) 또는 ctx를 빼면 밴드가 바뀌는 날
  const factLines = core.facts.filter((f) => CONTEXT_FACT_RE.test(f)).map((f) => hanjaToKo(f));
  const shift = input.personal.shift ?? 0;
  const noCtxBand = bandOf(toTenPoint(Math.max(0, Math.min(1, toScore01(core.parts.raw + core.parts.rel) + shift))));
  const bandByCtx = core.parts.ctx !== 0 && noCtxBand !== band;
  const includeContext = factLines.length > 0 || bandByCtx;
  const context = !includeContext
    ? []
    : factLines.length
      ? factLines
      : core.contextFacts.filter((f) => /^(올해 운|지금 10년 단위 운) /.test(f)).map((f) => hanjaToKo(f));

  // 영역 (→는 글로 풀지 않는다): 오늘 것을 코어 순서(|합| 순)대로 먼저, 이달·올해는 맥락을 쓰는 날만 그다음. 같은 영역은 한 번.
  // v4.21 (ChatGPT 3차 9항): ↑를 먼저 보내던 정렬은 뺐다 — 맥락을 쓰는 날 이달 ↑가 오늘 ↓를 밀어냈다. 좋음·주의에 맞추려고 영역을 고르지 않는다
  const nonFlat = core.areas.filter((a) => a.signal !== "→");
  const ordered = [...nonFlat.filter((a) => a.period === "오늘"), ...(includeContext ? nonFlat.filter((a) => a.period !== "오늘") : [])];
  const areas: PlanArea[] = [];
  for (const a of ordered) {
    if (areas.some((x) => x.area === a.area)) continue;
    areas.push({ period: a.period, area: a.area, word: AREA_WORD[a.area], signal: a.signal });
    if (areas.length === 2) break;
  }

  const allPool = TEN_GOD_EXPRESSIONS[corePart.tenGod];
  const coreStems = [...new Set([corePart.meaning, ...allPool.경향, ...allPool.과할때, ...allPool.활용, ...(support?.kind === "기운" ? [support.part.meaning, ...TEN_GOD_EXPRESSIONS[support.part.tenGod].경향] : [])].flatMap((s) => [...stemSet(s)]))];

  return {
    core: corePart,
    support,
    includeContext,
    contextReason: !includeContext ? null : factLines.length ? "운이 바뀌거나 오늘과 어긋나는 날" : "운 맥락이 단계를 바꾸는 날",
    context,
    areas,
    avoid: avoidFromRecent(input.date, input.recent ?? []),
    coreStems,
  };
}

export function planSummary(p: FortunePlan): FortunePlanSummary {
  return {
    core: { part: p.core.part, tenGod: p.core.tenGod, read: p.core.read },
    support: p.support ? { kind: p.support.kind, text: p.support.kind === "기운" ? p.support.part.meaning : p.support.text } : null,
    includeContext: p.includeContext,
    contextReason: p.contextReason,
    areas: p.areas.map(({ period, area, signal }) => ({ period, area, signal })),
  };
}

/** v4.19: 기록용 의미 태그 — 모델이 아니라 코드가 계획과 최종 글에서 만든다 (태그로 거부하지 않는다) */
export function tagsFromPlan(p: FortunePlan, text: { headline: string; body: string; do: string; dont: string }, band: string): FortuneTags {
  const all = [text.body, text.do, text.dont].join(" ");
  return {
    주제: `${p.core.meaning} · ${p.core.read}`,
    감정: band,
    상황: p.support ? (p.support.kind === "기운" ? p.support.part.meaning : p.support.text) : "-",
    영역: p.areas.map((a) => `${a.word}${a.signal}`).join("·") || "-",
    장면: SCENE_WORDS.filter((w) => all.includes(w)).join("·") || "-",
    권장: text.do,
    피할: text.dont,
    제목뜻: text.headline,
  };
}
