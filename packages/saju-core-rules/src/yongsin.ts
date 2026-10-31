// 원본: 사주 코어 core/src/yongsin.ts @ 4f795caaff12b331779feacbc2f4a49caa24c211 (2026-10-31 복사, 이전 240c91d). 바꾼 점: ../vendor/manseryeok/elementDistribution → @saju/engine. 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/용신.md — 세력(Y-02)·신강약(Y-03)·중심기운(Y-04)·용신(Y-05)·희기구한(Y-06)
// ·용신 등급(Y-07)·운의 유불리(Y-09)·시간 모름(Y-10). 균형붕괴·전왕표(Y-08)는 2026-10-07 사용자 결정으로 뺌("비겁이 많으면 식재관이 전부 좋다"와 양립 불가)
import {
  type Element, type Group, type Pillars, type Role, type Node,
  ELEMENTS, GROUPS, STEMS, BRANCHES, STEM_EL, BRANCH_EL, GEN, CTRL, CTRL_BY,
  groupMap, mainStem, nodesOf, adjacent, isDayStem, nodeName, tenGod, isYang,
} from "./base";
import { johu, letterTemp } from "./extras";   // J-05 조후 통합 (extras.ts는 이 파일에서 type만 가져가므로 순환 없음)
import { calculateElementDistribution } from "@saju/engine";   // 세력방식 "엔진분포" (비교용)

export type Amount = "없음" | "약함" | "보통" | "강함";
export type Strength = "신강" | "중화" | "신약";
export type YongsinMethod = "현묘표" | "병약";

const HYUNMYO: Record<Group, Group> = { 비겁: "재성", 인성: "재성", 식상: "인성", 재성: "비겁", 관성: "비겁" };
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Y-02 세력을 셀 때 지지를 어떻게 나누는가 (2026-10-07 사용자 질문 "지장간을 염두에 두고 세력을 판단하는가" → 선택지로 넣음, 기본은 정기)
 *  - 정기: 지지를 대표오행 하나로(2026-09-20 채택안). 강사 라벨 일치가 가장 높음
 *  - 지장간일수: 노트 입문 6강 12지지 상세표의 여기·중기·정기 일수 비율로 나눔
 *  - 진춘익: 여기 20 · 중기 30 · 정기 50 (두 글자 지지는 30 · 70), 寅巳申亥의 戊·午의 己는 뺌 (입문 6강 "새로운 관점")
 *  - 정기70지장간30: 정기 70% + 나머지 30%를 일수 비율로 — 가장 순한 절충
 *  측정(core/검증_세력.ts, 2026-10-07): 지장간을 넣는 쪽은 전부 라벨 일치가 내려감 → 카드 016으로 물음 */
export type PowerMethod = "정기" | "지장간일수" | "진춘익" | "정기70지장간30" | "엔진분포" | "정기80엔진20" | "정기70엔진30" | "정기연속" | "정기연속80엔진20";
export const POWER_METHODS: PowerMethod[] = ["정기", "지장간일수", "진춘익", "정기70지장간30", "엔진분포", "정기80엔진20", "정기70엔진30", "정기연속", "정기연속80엔진20"];
// 정기연속 = 정기 글자 세기에, 같은 오행 글자가 바로 옆(같은 기둥 짝·옆 기둥 같은 층)에 붙어 있으면 그 글자 ×1.2 [가설] — 카드 033 확답(2026-10-17) "관성이 강하다는 거 자체가 중심기운이다. 그리고 강한 기준은 T존에 있을 때, 연속으로 붙어 있을 때. 년주는 다른 주보다 조금 정도가 낮다."
//   측정(라벨): 신강약 19→20/22, 중심 35→36/39, 용신 34/38·운 79/90 그대로. T존·연간 가중은 이미 있음. 연지를 1.5→1.25로 낮추면 용신 1건이 어긋나 넣지 않음
const CONTIG = 0.2;
// 정기80엔진20 = 정기 글자 세기 % × 0.8 + 엔진 공식 % × 0.2 (카드 016 확답 2026-10-07: "a와 e의 비중을 7:3~8:2 — 대부분 기존대로, 중화 근처에서 e를 쓸 수 있게", 카드 017 메모 "8:2로")
/** 풀이(readFromPillars)가 쓰는 기본 세력 방식 — 카드 016 [합의·조건부 2026-10-07]. 라이브러리 함수 balance()/power()의 기본값은 비교·테스트를 위해 "정기" 그대로.
 *  측정(검증_세력.ts): 정기 19·37·34·운 76 / 8:2 19·35·34·75 / 7:3 19·36·35·75 — 7:3이 조금 더 맞지만 사용자가 8:2를 골랐음 */
export const DEFAULT_POWER_METHOD: PowerMethod = "정기연속80엔진20";   // 카드 016(8:2) + 033(붙어 있으면 강함), 2026-10-18
// 엔진분포 = 만세력 앱의 분포율 공식 전체(자료 B: 지장간 벡터 + 방합·삼합 배수 + 같은 층 생극 + 화수 보정 + 천간이 지지에서 받는 힘). 2026-09-15에 중심기운 12/23으로 글자 세기에 밀렸고,
// 2026-10-07 재측정(core/검증_세력.ts)도 신강약 18/22 · 중심 30/39 · 용신 30/38 · 운 73/90으로 정기보다 낮음. 비교·표시용으로만 둠
/** 지장간 일수 [노트 입문 6강 12지지 상세표] — 여기, (중기), 정기 순 */
export const HIDDEN_DAYS: Record<string, [string, number][]> = {
  寅: [["戊", 7.2], ["丙", 7.2], ["甲", 16.3]], 卯: [["甲", 10.5], ["乙", 20.6]], 辰: [["乙", 9.3], ["癸", 3.1], ["戊", 18.6]],
  巳: [["戊", 7.25], ["庚", 7.25], ["丙", 16.55]], 午: [["丙", 10.35], ["己", 9.3], ["丁", 11.35]], 未: [["丁", 9.3], ["乙", 3.1], ["己", 18.6]],
  申: [["戊", 7.35], ["壬", 7.25], ["庚", 16.3]], 酉: [["庚", 10.35], ["辛", 20.65]], 戌: [["辛", 9.3], ["丁", 3.1], ["戊", 18.6]],
  亥: [["戊", 7.35], ["甲", 7.25], ["壬", 16.3]], 子: [["壬", 10.35], ["癸", 20.65]], 丑: [["癸", 9.3], ["辛", 3.1], ["己", 18.6]],
};
/** 지지 한 글자의 오행별 비중(합 1) */
export function branchSplit(b: string, m: PowerMethod): [Element, number][] {
  if (m === "정기") return [[BRANCH_EL[b], 1]];
  const d = HIDDEN_DAYS[b]; const tot = d.reduce((a, x) => a + x[1], 0);
  if (m === "지장간일수") return d.map(([s, n]) => [STEM_EL[s], n / tot]);
  if (m === "정기70지장간30") return [[BRANCH_EL[b], 0.7], ...d.map(([s, n]) => [STEM_EL[s], 0.3 * n / tot] as [Element, number])];
  let stems = d.map(([s]) => s); if ("寅巳申亥".includes(b)) stems = stems.filter((s) => s !== "戊"); if (b === "午") stems = stems.filter((s) => s !== "己");
  const w = stems.length === 3 ? [0.2, 0.3, 0.5] : [0.3, 0.7]; return stems.map((s, i) => [STEM_EL[s], w[i]]);
}

/** Y-02 판정용 세력: 일간 1.0, 연간 1.0, 월간·시간 1.5, 연·월·시지 1.5, 일지 2.25. 지지는 `method`대로 나눔(기본 정기) */
export function power(p: Pillars, method: PowerMethod = "정기"): Record<Element, number> {
  if (method === "정기80엔진20" || method === "정기70엔진30" || method === "정기연속80엔진20") {
    const w = method === "정기70엔진30" ? 0.7 : 0.8; const a = power(p, method === "정기연속80엔진20" ? "정기연속" : "정기"), e = power(p, "엔진분포");
    return Object.fromEntries(ELEMENTS.map((el) => [el, a[el] * w + e[el] * (1 - w)])) as Record<Element, number>;
  }
  if (method === "엔진분포") {                                                                          // 입력 순서는 시→일→월→년
    const order = [3, 2, 1, 0].filter((i) => p[i]); const r: any = calculateElementDistribution(order.map((i) => p[i]![0]).join(""), order.map((i) => p[i]![1]).join(""));
    const pct = r.originalPercentage ?? r.percentage; return Object.fromEntries(ELEMENTS.map((e) => [e, pct[e]])) as Record<Element, number>;
  }
  const sc = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  if (method === "정기연속") {
    const N = nodesOf(p);
    for (const n of N) { const w0 = n.kind === "간" ? (n.pos === 1 || n.pos === 3 ? 1.5 : 1) : n.pos === 2 ? 2.25 : 1.5; sc[n.el] += w0 * (N.some((m) => m !== n && m.el === n.el && adjacent(n, m)) ? 1 + CONTIG : 1); }
  } else p.forEach((g, i) => {
    if (!g) return;
    sc[STEM_EL[g[0]]] += i === 2 ? 1 : i === 1 || i === 3 ? 1.5 : 1;
    const w = i === 2 ? 2.25 : 1.5; for (const [e, f] of branchSplit(g[1], method)) sc[e] += w * f;
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

export function balance(p: Pillars, method: PowerMethod = "정기"): Balance {
  const pct = power(p, method);
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
  // Y-06 보충 [사용자 확답 2026-10-07 카드 012 · 2026-10-18 풀이 카드 P009]: "용희신, 기구신 이렇게 뭉뚱그려 해야 해. 인성이 용신이고 재성이 기신이면, 보통 인성 비겁이 용희신이야. 그리고 관성은 한신."
  //   (012: 신약 #34 "목·화가 용희신" = 인성·비겁). 신약에 인성 용신이면 희신 = 비겁, 한신 = 관성(용신을 생하는 관성이 아니라 같은 편의 비겁). 중화의 경우는 카드 039
  if (method === "현묘표" && b.신강약 === "신약" && y === "인성") { 역할.비겁 = "희"; 역할.관성 = "한"; why += " · 신약이라 희신은 같은 편 비겁, 관성은 한신 (Y-06 보충)"; }
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


export type LuckVerdict = "매우 유리" | "유리" | "보통" | "주의" | "어려움";
export type LuckPart = { 글자: string; 오행: Element; 십신: string; 그룹: Group; 라벨: Role; 점수: number; 판정: LuckVerdict };
export type Luck = {
  간지: string; 방식: "라벨 점수";
  천간: LuckPart; 지지: LuckPart; 합계: number; 판정: LuckVerdict;
  확신도: "보통" | "낮음"; 플래그: string[];
};
const SCORE: Record<Role, number> = { 용: 2, 희: 1, 한: 0.5, 구: -1, 기: -2 };
const verdict = (s: number): LuckVerdict => (s >= 3 ? "매우 유리" : s > 0 ? "유리" : s === 0 ? "보통" : s <= -3 ? "어려움" : "주의");

// Y-13 극단 비겁 [카드 007 기각·대체 2026-10-07]: 비겁 중심인데 원국에 식·재·관 글자가 하나도 없으면 전왕이 아니라 "그 기운이 강하게 드러날 뿐".
//   운은 식상이 가장 좋고(설기, 부작용 없음), 인성·비겁은 안 좋지만 익숙한 기운이라 치명적이지 않고, 재성·관성이 가장 치명적(여덟이 하나를 극하려 들고, 누르려다 튕겨 나감). 점수는 [가설]
const EXTREME_BI_SCORE: Record<Group, number> = { 식상: 2, 비겁: -1, 인성: -1, 재성: -2, 관성: -2 };
// Y-14 [카드 008 기각·대체 2026-10-07]: 운 비겁의 무게는 천간·지지 자체가 아니라 "그 층에 원국의 식·재·관이 있는가"로 — 있으면 그것을 치니 더 불리(그대로 −2), 없으면 하나 더 오나 안 오나 비슷(−1 [가설]).
//   비겁이 아주 강하면(비겁 70% 이상 [가설]) 재성·관성 운은 튕겨 나가거나 손상될 수 있는 양날의 검 → 점수 절반 [가설] + 플래그
const HEAVY_BI = 70;
// Y-15 [합의·조건부 2026-10-07 카드 010]: 비겁 중심 신강에서 원국 지지에 비겁이 셋 이상 [가설]이면, 운 지지로 오는 재성은 군겁쟁재로 매우 위험(기신급 −2, 뜨거운 사주의 수여도 "화토가 많아 더 위축"이라 온도로 구제 안 함),
//   관성은 그 비겁들을 누르느라 부담이 크지만 "극당하는 것보단 극하는 게 덜 위험" → 점수 절반 [가설]
const PRESS_BI = 3;

/** Y-09 운의 유불리 (+ Y-12·Y-13·Y-14 보조, J-05 조후 통합). 충·합 플래그는 relations.ts가 따로 붙입니다 */
export function luck(p: Pillars, ganji: string, b: Balance, y: Yongsin): Luck {
  const day = p[2][0]; const { toGroup } = groupMap(day);
  // Y-12 [합의 2026-10-07 카드 002]: 비겁이 중심인 신강 사주에서 관성은 한신(0.5)이 아니라 희신급(1)으로 — "식·재·관 전부 +, 다만 운에서 결국 기다리는 건 재성"
  // 비겁이 1순위면 1, 인성이 앞서는 혼합(인비)이면 비겁 비율만큼(5라운드 Q2), 그 밖은 0
  const assistW = b.신강약 !== "신강" ? 0 : b.중심기운 === "비겁" ? 1 : b.묶음이름 === "인비" ? b.그룹퍼센트.비겁 / Math.max(1, b.그룹퍼센트.비겁 + b.그룹퍼센트.인성) : 0;
  const assist = assistW > 0;
  const own = nodesOf(p).filter((n) => !isDayStem(n)); const isSJG = (n: Node) => { const g = toGroup[n.el]; return g === "식상" || g === "재성" || g === "관성"; };
  const biCenter = b.중심기운 === "비겁"; const extremeBi = biCenter && !own.some(isSJG);                       // Y-13
  const strongBi = biCenter && b.신강약 === "신강"; const heavyBi = strongBi && b.그룹퍼센트.비겁 >= HEAVY_BI;   // Y-14
  const layerHasSJG = { 간: own.some((n) => n.kind === "간" && isSJG(n)), 지: own.some((n) => n.kind === "지" && isSJG(n)) };
  const biBranches = own.filter((n) => n.kind === "지" && toGroup[n.el] === "비겁").length;                     // Y-15
  const jo = johu(p, y);                                                                                        // J-05
  const 플래그: string[] = [];
  const part = (ch: string, isStem: boolean): LuckPart => {
    const stem = isStem ? ch : mainStem(ch); const el = STEM_EL[stem]; const g = toGroup[el]; const 라벨 = y.역할[g]; const m = isStem ? 1.5 : 1;
    let 점수 = SCORE[라벨] * m; let pressed = false;
    if (assist && g === "관성" && 라벨 === "한") 점수 = (SCORE.한 + (SCORE.희 - SCORE.한) * assistW) * m;
    // Y-12 신약 가지 [합의 2026-10-07 카드 012]: 신약에서 용신이 인성이면 비겁 운도 희신급 — "목·화가 용희신, 목화로 일간의 기운을 강하게"
    if (b.신강약 === "신약" && y.용신그룹 === "인성" && g === "비겁") { 점수 = SCORE.희 * m; 플래그.push(`운 ${ch} 비겁: 신약·인성 용신이라 비겁도 희신급 (Y-12 신약, 카드 012)`); }
    // 카드 014 [기각·대체 2026-10-07]: 신약에서 관성 운은 불리(기신급) — 현묘표가 희신으로 두는 인성 용신 사주도 같음. 원국에 관성이 하나도 없으면 오히려 성실·자기관리로 좋음(희신급).
    //   양간 일간에 편관이면 육체·정신 조심, 원국에 식상이 있으면 관성과 대립해 독특한 장단점(길흉 함께)
    // 카드 019 [합의·조건부 2026-10-08]: 편관과 정관은 다르게, 일간 음양에 따라 반응이 다르다. 점수는 전부 [가설]
    //   양간+편관 = 강하게 반응(강압·억압, 대신 강렬하고 효과가 큼 — 스트레스·건강 부담 ↔ 명예·성과) → 기신급 그대로
    //   양간+정관 = 음이 양을 극하기 힘들어 세게 누르지 못함, 뿌리가 약해 불편한 정도 → −0.5
    //   음간+편관 = 덜 반응하지만 불편 → −1
    //   음간+정관 = 천간합의 짝이라 불편하지만 은근히 기다림 → −0.5
    //   신약인데 식상이 중심이면 지지로 오는 관성은 식상의 기운을 빼 줘 식상·관성의 힘이 비슷해짐 → 0 (나쁘지 않음)
    if (b.신강약 === "신약" && g === "관성") {
      const god = tenGod(day, stem).god; const yang = isYang(day);
      if (!own.some((n) => toGroup[n.el] === "관성")) { 점수 = SCORE.희 * m; 플래그.push(`운 ${ch} 관성: 원국에 관성이 없어 오히려 성실해지고 자기관리를 하게 되어 좋음 (카드 014)`); }
      else {
        const base = yang && god === "편관" ? SCORE.기 : yang ? -0.5 : god === "편관" ? -1 : -0.5;
        점수 = base * m;
        플래그.push(yang && god === "편관" ? `운 ${ch} 편관(양간 일간): 강압적이고 강렬 — 스트레스·건강 부담이 크지만 명예·성과도 크게 날 수 있음, 육체·정신 아주 조심 (카드 014·019)`
          : yang ? `운 ${ch} 정관(양간 일간): 음이 양을 세게 누르지 못함 — 뿌리가 약해 불편한 정도, 차분하지만 융통성이 줄고 답답 (카드 019)`
          : god === "편관" ? `운 ${ch} 편관(음간 일간): 덜 반응하지만 불편 (카드 019)`
          : `운 ${ch} 정관(음간 일간): 천간합의 짝 — 불편하지만 은근히 기다리던 기운, 차분하지만 답답할 수 있음 (카드 019)`);
        // 카드 031 [합의 2026-10-17 "너가 맞고 답답함이 쌓여 숨이 막힘이다"]: 관성이 이미 중심인 신약은 양간·음간 모두 정관 운도 기신급 — 누르는 기운이 가득한데 하나 더
        if (b.중심기운 === "관성" && god === "정관") { 점수 = SCORE.기 * m; 플래그.push(`운 ${ch} 정관: 관성이 이미 중심이라 규칙·책임이 더 쌓임 — 답답함이 쌓여 숨이 막히는 때 (카드 031)`); }
        if (!isStem && b.중심기운 === "식상") { 점수 = 0; 플래그.push(`운 ${ch} 관성이 지지로 옴: 식상이 중심이라 그 기운을 빼 줘 식상·관성의 힘이 비슷해짐 — 나쁘지 않음 (카드 019)`); }
        else {
          플래그.push(`운 ${ch} 관성(신약): 삶이 바빠지거나 번아웃이 오거나 스트레스가 강해져 부담스러운 때 (카드 021)`);   // 카드 021 [합의·조건부 2026-10-15] 신약 쪽의 공통 결
          if (own.some((n) => toGroup[n.el] === "식상")) 플래그.push(`원국 식상과 운 관성이 대립 — 독특한 장단점이 함께 드러남 (카드 014)`);
        }
      }
    }
    // 카드 021 [합의·조건부 2026-10-15]: 신강에게 관성 운은 결 자체가 다르다 — "강한 기운을 눌러 주기 때문에 관성에 나를 어느 정도 깎아서 결과물을 내놓는다. 하지만 언제나 반동이 있을 수 있다". 점수는 그대로(용·희·한 라벨과 Y-12 보조)
    // 카드 025 [합의·조건부 2026-10-15]: "비겁이 너무 강할 때 관성이 오면 대체로 길하지만 비겁들이 한번에 움직이기 때문에 부작용이 있을 수 있다. 그래서 관성운이 왔을 때 반동이 온다고 해석할 수도 있고 마음적으로도 올 수 있다.
    //   반동의 크기는 양간이 신강할 때 편관이 왔을 때가 가장 크다." → 반동은 끝난 뒤가 아니라 그 운 동안. 크기 [가설]: 양간+편관 큼 / 양간+정관·음간+편관 보통 / 음간+정관 작음. 점수는 그대로
    if (b.신강약 === "신강" && g === "관성") {
      const god = tenGod(day, stem).god; const yang = isYang(day);
      const size = yang && god === "편관" ? "가장 큼" : yang || god === "편관" ? "보통" : "작음";
      플래그.push(`운 ${ch} ${god}(신강): 강한 기운을 눌러 줘 나를 깎아 결과물을 내놓는 때 — 대체로 길하지만 그 운 동안 반동이 올 수 있음(마음 쪽으로도), 반동 크기 ${size} (카드 021·025)`);
      if (b.그룹퍼센트.비겁 >= HEAVY_BI) 플래그.push(`운 ${ch} ${god}: 비겁이 ${b.그룹퍼센트.비겁}%로 너무 강해 비겁들이 한꺼번에 움직임 — 부작용이 커질 수 있음 (카드 025)`);
    }
    if (extremeBi) 점수 = EXTREME_BI_SCORE[g] * m;
    else {
      if (strongBi && g === "비겁" && !layerHasSJG[isStem ? "간" : "지"]) { 점수 = -1 * m; 플래그.push(`운 ${ch} 비겁: ${isStem ? "천간" : "지지"}에 원국 식·재·관이 없어 하나 더 와도 비슷 — 기신 −2 대신 −1 (Y-14)`); }
      if (heavyBi && (g === "재성" || g === "관성") && 점수 > 0) { 점수 = 점수 / 2; 플래그.push(`운 ${ch} ${g}: 비겁 ${b.그룹퍼센트.비겁}%라 튕겨 나가거나 손상될 수 있는 양날의 검 — 점수 절반 (Y-14)`); }
      if (strongBi && !isStem && biBranches >= PRESS_BI) {
        if (g === "재성") { 점수 = SCORE.기; pressed = true; 플래그.push(`운 ${ch} 재성이 원국 지지 비겁 ${biBranches}개 사이로 옴 — 군겁쟁재: 돈을 쫓아 변동성이 커져 많이 벌고 많이 잃음. 위험하지만 용신 작용은 함(길흉 함께) (Y-15·카드 013)`); }
        else if (g === "관성" && 점수 > 0) { 점수 = 점수 / 2; 플래그.push(`운 ${ch} 관성: 지지 비겁 ${biBranches}개를 누르느라 부담 — 극당하는 재성보단 덜 위험, 점수 절반 (Y-15)`); }
      }
    }
    if (jo.극단 && !pressed && !(extremeBi && (g === "재성" || g === "관성"))) {                                 // 극단 비겁의 재·관, 군겁쟁재 글자는 온도로 구제하지 않음(카드 007·010 확답)
      const t = letterTemp(ch); const adj = (jo.점수 > 0 ? -t : t) * m;
      if (adj) { 점수 += adj; 플래그.push(`운 ${ch}: ${jo.온도} 사주의 온도를 ${adj > 0 ? "맞춤" : "더 치우치게 함"} ${adj > 0 ? "+" : ""}${adj} (J-05 조후 통합)`); }
    }
    return { 글자: ch, 오행: el, 십신: tenGod(day, stem).god, 그룹: g, 라벨, 점수, 판정: verdict(점수) };
  };
  const 천간 = part(ganji[0], true), 지지 = part(ganji[1], false);
  // 카드 013 [합의·조건부 2026-10-07]: 운 천간이 원국 비겁 천간과 천간합이면 "비겁과 노느라 제 역할을 안 할 수 있음" → 천간 점수 절반 [가설] (예: #27 戊午의 戊癸합)
  const biCombine = own.find((n) => n.kind === "간" && toGroup[n.el] === "비겁" && STEM_COMBINE[n.ch] === ganji[0]);
  if (biCombine && 천간.점수 > 0) { 천간.점수 = 천간.점수 / 2; 천간.판정 = verdict(천간.점수); 플래그.push(`운 ${ganji[0]}이 ${nodeName(biCombine)}(비겁)과 합 — 비겁과 친해지느라 제 역할이 제한될 수 있음, 점수 절반 (카드 013)`); }
  if (extremeBi) 플래그.unshift(`극단 비겁(원국에 식·재·관 없음): 식상 운이 가장 좋고 인성·비겁은 익숙해 덜 치명적, 재성·관성 운이 가장 위험 (Y-13)`);
  const N = nodesOf(p).filter((n) => n.el === y.용신오행 && !isDayStem(n));
  for (const n of N) {
    const l = n.kind === "간" ? 천간 : 지지;
    if (CTRL[l.오행] === n.el) 플래그.push(`용신 손상: 운 ${l.글자}(${l.오행})이 ${nodeName(n)}을(를) 극함`);
    if (n.kind === "간" && STEM_COMBINE[n.ch] === ganji[0]) 플래그.push(`용신 손상: 운 ${ganji[0]}이 ${nodeName(n)}과(와) 합으로 묶음`);
  }
  const se = STEM_EL[ganji[0]], be = BRANCH_EL[ganji[1]];
  if (CTRL[se] === be) 플래그.push("운 내부 상충: 천간이 지지를 극함(절각)");
  if (CTRL[be] === se) 플래그.push("운 내부 상충: 지지가 천간을 극함(개두)");
  if (assist && (천간.그룹 === "관성" || 지지.그룹 === "관성")) 플래그.push(assistW === 1 ? "관성은 보조 용신 — 희신급으로 셈 (Y-12)" : `관성은 보조 용신 — 비겁 비율(${Math.round(assistW * 100)}%)만큼 (Y-12)`);
  if (y.중화) 플래그.push("중화 사주 → 운의 유불리보다 T존 십신 위주로 볼 것");
  const 합계 = 천간.점수 + 지지.점수;
  // 6라운드 Q1-b: 인성이 앞서는 혼합에서 관성 보조로 0 근처가 된 합계는 '보통' — 0.1 차이로 유리·주의가 갈리는 자리는 보통이 정직
  const capped = assistW > 0 && assistW < 1 && (천간.그룹 === "관성" || 지지.그룹 === "관성") && Math.abs(합계) < 0.5;
  if (capped) 플래그.push("혼합 사주의 관성 보조 — 합계가 0 근처라 '보통'으로 (Y-12)");
  return { 간지: ganji, 방식: "라벨 점수", 천간, 지지, 합계, 판정: capped ? "보통" : verdict(합계),
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
