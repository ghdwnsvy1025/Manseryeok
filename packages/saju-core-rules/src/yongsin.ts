// 원본: 사주 코어 core/src/yongsin.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/용신.md — 세력(Y-02)·신강약(Y-03)·중심기운(Y-04)·용신(Y-05)·희기구한(Y-06)
// ·용신 등급(Y-07)·균형붕괴(Y-08)·운의 유불리(Y-09)·시간 모름(Y-10)
import {
  type Element, type Group, type Pillars, type Role, type Node,
  ELEMENTS, GROUPS, STEMS, BRANCHES, STEM_EL, BRANCH_EL, GEN, CTRL, CTRL_BY,
  groupMap, mainStem, nodesOf, adjacent, isDayStem, nodeName, tenGod, isYang,
} from "./base";

export type Amount = "없음" | "약함" | "보통" | "강함";
export type Strength = "신강" | "중화" | "신약";
export type YongsinMethod = "현묘표" | "병약";

const HYUNMYO: Record<Group, Group> = { 비겁: "재성", 인성: "재성", 식상: "인성", 재성: "비겁", 관성: "비겁" };
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Y-02 판정용 세력: 일간 1.0, 연간 1.0, 월간·시간 1.5, 연·월·시지 1.5, 일지 2.25 */
export function power(p: Pillars): Record<Element, number> {
  const sc = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  p.forEach((g, i) => {
    if (!g) return;
    sc[STEM_EL[g[0]]] += i === 2 ? 1 : i === 1 || i === 3 ? 1.5 : 1;
    sc[BRANCH_EL[g[1]]] += i === 2 ? 2.25 : 1.5;
  });
  const tot = ELEMENTS.reduce((a, e) => a + sc[e], 0);
  return Object.fromEntries(ELEMENTS.map((e) => [e, (sc[e] / tot) * 100])) as Record<Element, number>;
}

/** 그 그룹의 글자가 실제로 있는가 — 일간 자신은 세지 않음, 지지는 정기 (영역.md E-00 보충) */
export function groupLetters(p: Pillars): Record<Group, Node[]> {
  const { toGroup } = groupMap(p[2][0]);
  const out = Object.fromEntries(GROUPS.map((g) => [g, [] as Node[]])) as Record<Group, Node[]>;
  for (const n of nodesOf(p)) if (!isDayStem(n)) out[toGroup[n.el]].push(n);
  return out;
}

export type Balance = {
  판정용퍼센트: Record<Element, number>;
  그룹퍼센트: Record<Group, number>;
  그룹오행: Record<Group, Element>;
  양: Record<Group, Amount>;
  인비: number;
  신강약: Strength;
  경계: boolean;
  중심기운: Group;
  혼합: Group | null;
  묶음이름: "인비" | "재관" | null;
  최강오행: Element;
};

export function balance(p: Pillars): Balance {
  const pct = power(p);
  const { toElement } = groupMap(p[2][0]);
  const gp = Object.fromEntries(GROUPS.map((g) => [g, pct[toElement[g]]])) as Record<Group, number>;
  const letters = groupLetters(p);
  const 양 = Object.fromEntries(GROUPS.map((g) => [g,
    letters[g].length === 0 ? "없음" : gp[g] >= 25 ? "강함" : gp[g] < 12 ? "약함" : "보통"])) as Record<Group, Amount>;
  const inbi = gp["비겁"] + gp["인성"];
  const 신강약: Strength = inbi >= 55 ? "신강" : inbi <= 45 ? "신약" : "중화";                       // Y-03
  const 경계 = Math.abs(inbi - 55) <= 2 || Math.abs(inbi - 45) <= 2;
  const order = [...GROUPS].sort((a, b) => gp[b] - gp[a] || GROUPS.indexOf(a) - GROUPS.indexOf(b));   // Y-04
  const [c1, c2] = order;
  const 혼합 = gp[c1] - gp[c2] < 3 ? c2 : null;
  const pair = new Set([c1, c2]);
  const 묶음이름 = !혼합 ? null : pair.has("비겁") && pair.has("인성") ? "인비" : pair.has("재성") && pair.has("관성") ? "재관" : null;
  const 최강오행 = [...ELEMENTS].sort((a, b) => pct[b] - pct[a])[0];
  return {
    판정용퍼센트: Object.fromEntries(ELEMENTS.map((e) => [e, round1(pct[e])])) as Record<Element, number>,
    그룹퍼센트: Object.fromEntries(GROUPS.map((g) => [g, round1(gp[g])])) as Record<Group, number>,
    그룹오행: toElement, 양, 인비: round1(inbi), 신강약, 경계, 중심기운: c1, 혼합, 묶음이름, 최강오행,
  };
}

export type Yongsin = {
  방식: YongsinMethod;
  용신그룹: Group; 용신오행: Element;
  역할: Record<Group, Role>;              // 그룹 → 용/희/기/구/한
  오행역할: Record<Element, Role>;
  판정불안정: boolean;
  중화: boolean;                          // true면 풀이는 T존 십신 위주, 용신은 보조
  근거: string;
};

export function yongsin(p: Pillars, b: Balance = balance(p), method: YongsinMethod = "현묘표"): Yongsin {
  const gp = b.그룹퍼센트; const c = b.중심기운;
  let y: Group; let unstable = false; let why: string;
  if (method === "병약") {
    // 앱(yongsin.ts) 호환용 단순 구현: 가장 강한 그룹을 극하는 그룹. T존 우선 등 세부는 앱 코드를 따르지 않음
    const el = CTRL_BY[b.그룹오행[c]]; y = GROUPS.find((g) => b.그룹오행[g] === el)!;
    why = `병약: 중심기운 ${c}을(를) 극하는 ${y}`;
  } else if (b.신강약 === "신강") {                                                                   // Y-05
    y = "재성"; unstable = !(c === "비겁" || c === "인성");
    why = `신강(인비 ${b.인비}) + 중심 ${c} → 재성`;
  } else if (b.신강약 === "신약") {
    if (c === "식상" || c === "재성" || c === "관성") { y = HYUNMYO[c]; why = `신약(인비 ${b.인비}) + 중심 ${c} → ${y}`; }
    else { y = gp["식상"] >= Math.max(gp["재성"], gp["관성"]) ? "인성" : "비겁"; unstable = true; why = `신약인데 중심이 ${c} (모순) → ${y}`; }
  } else { y = HYUNMYO[c]; why = `중화(인비 ${b.인비}) + 중심 ${c} → 현묘표 ${y}`; }
  const i = GROUPS.indexOf(y); const at = (k: number) => GROUPS[(i + k + 5) % 5];                     // Y-06
  const 역할 = { [y]: "용", [at(-1)]: "희", [at(-2)]: "기", [at(1)]: "한", [at(2)]: "구" } as Record<Group, Role>;
  const 오행역할 = Object.fromEntries(GROUPS.map((g) => [b.그룹오행[g], 역할[g]])) as Record<Element, Role>;
  return { 방식: method, 용신그룹: y, 용신오행: b.그룹오행[y], 역할, 오행역할, 판정불안정: unstable, 중화: b.신강약 === "중화", 근거: why };
}

const STEM_COMBINE: Record<string, string> = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };

export type YongsinGrade = {
  등급: "A" | "B" | "C" | "D";
  원국에있음: boolean; T존에있음: boolean; 힘: "있음" | "약함" | "매우 약함"; 극당함: boolean; 천간합강등: boolean;
  용신글자: string[]; 근거: string[];
};

/** Y-07. 구현 메모: ④에서 일간 자신은 "기신 글자"로 세지 않음(일간은 항상 T존에 붙어 있어 전부 C가 되기 때문).
 *  ①있음·④아니오·③매우 약함은 표에 없는 조합이라 C로 둠 [가설] */
export function yongsinGrade(p: Pillars, b: Balance, y: Yongsin): YongsinGrade {
  const N = nodesOf(p); const el = y.용신오행;
  const gi = GROUPS.find((g) => y.역할[g] === "기")!; const giEl = b.그룹오행[gi];
  const yn = N.filter((n) => n.el === el && !isDayStem(n));
  const 원국에있음 = yn.length > 0;
  const T존에있음 = yn.some((n) => (n.kind === "간" && (n.pos === 1 || n.pos === 3)) || (n.kind === "지" && n.pos === 2));
  const pc = b.판정용퍼센트[el]; const 힘 = pc >= 12 ? "있음" : pc >= 8 ? "약함" : "매우 약함";
  const hits = yn.flatMap((n) => N.filter((m) => m.el === giEl && !isDayStem(m) && adjacent(n, m)).map((m) => `${nodeName(m)} → ${nodeName(n)}`));
  const 극당함 = hits.length > 0;
  let g: "A" | "B" | "C" | "D" = !원국에있음 ? "D" : 극당함 ? "C" : T존에있음 && 힘 === "있음" ? "A" : 힘 !== "매우 약함" ? "B" : "C";
  const stems = yn.filter((n) => n.kind === "간");
  const combined = stems.filter((n) => N.some((m) => m.kind === "간" && !isDayStem(m) && adjacent(n, m) && STEM_COMBINE[n.ch] === m.ch));
  const 천간합강등 = stems.length > 0 && combined.length === stems.length;
  if (천간합강등 && g !== "D") g = ({ A: "B", B: "C", C: "D" } as const)[g];
  const 근거 = [`용신 ${el} 글자: ${yn.map(nodeName).join(", ") || "없음"}`, `판정용 ${pc}% → 힘 ${힘}`];
  if (극당함) 근거.push(`기신(${giEl})이 인접: ${hits.join(" / ")}`);
  if (천간합강등) 근거.push(`용신 천간이 다른 천간과 합 → 한 등급 내림`);
  return { 등급: g, 원국에있음, T존에있음, 힘, 극당함, 천간합강등, 용신글자: yn.map(nodeName), 근거 };
}

/** Y-08 균형이 무너진 사주: 중심기운 ≥ 50% 그리고 용신 오행 ≤ 8% */
export const isCollapsed = (b: Balance, y: Yongsin): boolean => b.그룹퍼센트[b.중심기운] >= 50 && b.판정용퍼센트[y.용신오행] <= 8;
const JEONWANG: Record<Group, { good: Group[]; bad: Group[]; must: Group }> = {
  비겁: { good: ["인성", "비겁", "식상"], bad: ["재성", "관성"], must: "재성" },
  식상: { good: ["비겁", "식상", "재성"], bad: ["관성", "인성"], must: "관성" },
  재성: { good: ["식상", "재성", "관성"], bad: ["인성", "비겁"], must: "인성" },
  관성: { good: ["재성", "관성", "인성"], bad: ["비겁", "식상"], must: "비겁" },
  인성: { good: ["관성", "인성", "비겁"], bad: ["식상", "재성"], must: "식상" },
};

export type LuckVerdict = "매우 유리" | "유리" | "보통" | "주의" | "어려움";
export type LuckPart = { 글자: string; 오행: Element; 십신: string; 그룹: Group; 라벨: Role; 점수: number; 판정: LuckVerdict };
export type Luck = {
  간지: string; 방식: "라벨 점수" | "전왕표";
  천간: LuckPart; 지지: LuckPart; 합계: number; 판정: LuckVerdict;
  확신도: "보통" | "낮음"; 플래그: string[];
};
const SCORE: Record<Role, number> = { 용: 2, 희: 1, 한: 0.5, 구: -1, 기: -2 };
const verdict = (s: number): LuckVerdict => (s >= 3 ? "매우 유리" : s > 0 ? "유리" : s === 0 ? "보통" : s <= -3 ? "어려움" : "주의");

/** Y-09 운의 유불리. 충·합 플래그는 chung.ts / hap.ts가 따로 붙입니다 */
export function luck(p: Pillars, ganji: string, b: Balance, y: Yongsin): Luck {
  const day = p[2][0]; const collapsed = isCollapsed(b, y); const { toGroup } = groupMap(day);
  const part = (ch: string, isStem: boolean): LuckPart => {
    const stem = isStem ? ch : mainStem(ch); const el = STEM_EL[stem]; const g = toGroup[el]; const 라벨 = y.역할[g];
    let 점수 = SCORE[라벨] * (isStem ? 1.5 : 1);
    if (collapsed) { const t = JEONWANG[b.중심기운]; 점수 = (t.must === g ? -3 : t.bad.includes(g) ? -1.5 : 1.5); }
    return { 글자: ch, 오행: el, 십신: tenGod(day, stem).god, 그룹: g, 라벨, 점수, 판정: verdict(점수) };
  };
  const 천간 = part(ganji[0], true), 지지 = part(ganji[1], false);
  const 플래그: string[] = [];
  const N = nodesOf(p).filter((n) => n.el === y.용신오행 && !isDayStem(n));
  for (const n of N) {
    const l = n.kind === "간" ? 천간 : 지지;
    if (CTRL[l.오행] === n.el) 플래그.push(`용신 손상: 운 ${l.글자}(${l.오행})이 ${nodeName(n)}을(를) 극함`);
    if (n.kind === "간" && STEM_COMBINE[n.ch] === ganji[0]) 플래그.push(`용신 손상: 운 ${ganji[0]}이 ${nodeName(n)}과(와) 합으로 묶음`);
  }
  const se = STEM_EL[ganji[0]], be = BRANCH_EL[ganji[1]];
  if (CTRL[se] === be) 플래그.push("운 내부 상충: 천간이 지지를 극함(절각)");
  if (CTRL[be] === se) 플래그.push("운 내부 상충: 지지가 천간을 극함(개두)");
  if (collapsed) 플래그.push("균형이 무너진 사주 → 전왕표로 판정 (Y-08)");
  if (y.중화) 플래그.push("중화 사주 → 운의 유불리보다 T존 십신 위주로 볼 것");
  const 합계 = 천간.점수 + 지지.점수;
  return { 간지: ganji, 방식: collapsed ? "전왕표" : "라벨 점수", 천간, 지지, 합계, 판정: verdict(합계),
    확신도: y.판정불안정 || y.중화 ? "낮음" : "보통", 플래그 };
}

/** 일간과 시지로 시주 만들기 (시간 모름 처리에 씀) */
export const hourPillar = (dayStem: string, branchIdx: number): string =>
  STEMS[([0, 2, 4, 6, 8][STEMS.indexOf(dayStem) % 5] + branchIdx) % 10] + BRANCHES[branchIdx];

export type Tally<T extends string> = { 값: T | null; 표: number; 분포: Record<string, number>; 말하기: "확정에 준함" | "가능성 높음" | "말하지 않음" };
export function tally<T extends string>(values: T[]): Tally<T> {
  const 분포: Record<string, number> = {}; for (const v of values) 분포[v] = (분포[v] ?? 0) + 1;
  const [값, 표] = Object.entries(분포).sort((a, b) => b[1] - a[1])[0] as [T, number];
  const 말하기 = 표 >= 10 ? "확정에 준함" : 표 >= 8 ? "가능성 높음" : "말하지 않음";
  return { 값: 말하기 === "말하지 않음" ? null : 값, 표, 분포, 말하기 };
}
/** Y-10 시간 모름: 12개 시주를 모두 넣어 항목별로 집계 */
export function unknownHour(p: Pillars, method: YongsinMethod = "현묘표") {
  const runs = Array.from({ length: 12 }, (_, i) => {
    const q: Pillars = [p[0], p[1], p[2], hourPillar(p[2][0], i)]; const b = balance(q); const y = yongsin(q, b, method);
    return { 시주: q[3]!, 신강약: b.신강약, 중심기운: b.중심기운, 용신오행: y.용신오행 };
  });
  return {
    시주별: runs,
    신강약: tally(runs.map((r) => r.신강약)), 중심기운: tally(runs.map((r) => r.중심기운)), 용신오행: tally(runs.map((r) => r.용신오행)),
  };
}
export { isYang };
