// 원본: 사주 코어 core/src/base.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 기초 부품 — 간지표, 오행 생극, 십신, 자리와 인접. 모든 규칙 모듈이 이 파일을 씁니다.
// 자리 번호: 연 0, 월 1, 일 2, 시 3 (규칙/구조.md)

export type Element = "목" | "화" | "토" | "금" | "수";
export type Group = "비겁" | "식상" | "재성" | "관성" | "인성";
export type TenGod = "비견" | "겁재" | "식신" | "상관" | "편재" | "정재" | "편관" | "정관" | "편인" | "정인";
export type Role = "용" | "희" | "기" | "구" | "한";
/** 연·월·일·시 간지. 시간을 모르면 시 = null */
export type Pillars = [string, string, string, string | null];

export const STEMS = "甲乙丙丁戊己庚辛壬癸";
export const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
export const STEMS_KO = "갑을병정무기경신임계";
export const BRANCHES_KO = "자축인묘진사오미신유술해";
export const ELEMENTS: Element[] = ["목", "화", "토", "금", "수"];
export const GROUPS: Group[] = ["비겁", "식상", "재성", "관성", "인성"];
export const POS_NAME = ["연", "월", "일", "시"];

const zip = <T>(keys: string, vals: T[]): Record<string, T> => Object.fromEntries([...keys].map((k, i) => [k, vals[i]]));
export const STEM_EL = zip<Element>(STEMS, [..."목목화화토토금금수수"] as Element[]);
export const BRANCH_EL = zip<Element>(BRANCHES, [..."수토목목토화화토금금토수"] as Element[]);
/** 지장간: 여기 → (중기) → 정기 순. 마지막 글자가 정기 [노트 입문 6강] */
export const HIDDEN: Record<string, string> = {
  子: "壬癸", 丑: "癸辛己", 寅: "戊丙甲", 卯: "甲乙", 辰: "乙癸戊", 巳: "戊庚丙",
  午: "丙己丁", 未: "丁乙己", 申: "戊壬庚", 酉: "庚辛", 戌: "辛丁戊", 亥: "戊甲壬",
};
export const mainStem = (branch: string): string => HIDDEN[branch].at(-1)!;

export const GEN: Record<Element, Element> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" }; // A가 생하는 것
export const CTRL: Record<Element, Element> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" }; // A가 극하는 것
export const GEN_BY = Object.fromEntries(Object.entries(GEN).map(([a, b]) => [b, a])) as Record<Element, Element>;
export const CTRL_BY = Object.fromEntries(Object.entries(CTRL).map(([a, b]) => [b, a])) as Record<Element, Element>;

export const isYang = (ch: string): boolean =>
  STEMS.includes(ch) ? STEMS.indexOf(ch) % 2 === 0 : BRANCHES.indexOf(ch) % 2 === 0;
export const elementOf = (ch: string): Element => STEM_EL[ch] ?? BRANCH_EL[ch];

/** 일간 오행 기준으로 오행 → 십신 그룹 (Y-01) */
export function groupMap(dayStem: string): { toGroup: Record<Element, Group>; toElement: Record<Group, Element> } {
  const d = STEM_EL[dayStem];
  const toGroup = { [d]: "비겁", [GEN[d]]: "식상", [CTRL[d]]: "재성", [CTRL_BY[d]]: "관성", [GEN_BY[d]]: "인성" } as Record<Element, Group>;
  const toElement = Object.fromEntries(Object.entries(toGroup).map(([e, g]) => [g, e])) as Record<Group, Element>;
  return { toGroup, toElement };
}

const PAIR: Record<Group, [TenGod, TenGod]> = {
  비겁: ["비견", "겁재"], 식상: ["식신", "상관"], 재성: ["편재", "정재"], 관성: ["편관", "정관"], 인성: ["편인", "정인"],
};
/** 천간 글자의 십신. 지지는 mainStem()으로 정기를 뽑아 넣습니다 */
export function tenGod(dayStem: string, stem: string): { group: Group; god: TenGod } {
  const group = groupMap(dayStem).toGroup[STEM_EL[stem]];
  return { group, god: PAIR[group][isYang(dayStem) === isYang(stem) ? 0 : 1] };
}
export const groupOfGod = (god: TenGod): Group => GROUPS.find((g) => PAIR[g].includes(god))!;

/** 원국의 글자 하나 */
export type Node = { kind: "간" | "지"; pos: number; ch: string; el: Element };
export function nodesOf(p: Pillars): Node[] {
  const out: Node[] = [];
  p.forEach((g, pos) => {
    if (!g) return;
    out.push({ kind: "간", pos, ch: g[0], el: STEM_EL[g[0]] }, { kind: "지", pos, ch: g[1], el: BRANCH_EL[g[1]] });
  });
  return out;
}
/** 인접 = 같은 기둥의 간-지, 또는 같은 줄에서 자리 차 1. 대각선은 아님 [노트 중급 4강] */
export const adjacent = (a: Node, b: Node): boolean =>
  (a.pos === b.pos && a.kind !== b.kind) || (a.kind === b.kind && Math.abs(a.pos - b.pos) === 1);
export const isDayStem = (n: Node): boolean => n.kind === "간" && n.pos === 2;
export const nodeName = (n: Node): string => `${POS_NAME[n.pos]}${n.kind} ${n.ch}`;

/** "갑술 정축 계묘 무오" 또는 한자. 시주는 생략 가능(시간 모름) */
export function parsePillars(text: string): Pillars {
  const parts = text.replace(/,/g, " ").trim().split(/\s+/);
  if (parts.length < 3 || parts.length > 4) throw new Error("연주 월주 일주 (시주) 순서로 3~4개를 넣어 주세요");
  const conv = parts.map((g) => {
    if ([...g].length !== 2) throw new Error(`'${g}': 간지는 두 글자입니다`);
    const [a, b] = [...g];
    const s = STEMS.includes(a) ? a : STEMS[STEMS_KO.indexOf(a)];
    const br = BRANCHES.includes(b) ? b : BRANCHES[BRANCHES_KO.indexOf(b)];
    if (!s || !br) throw new Error(`'${g}': 읽을 수 없는 간지입니다`);
    if (isYang(s) !== isYang(br)) throw new Error(`'${g}': 천간과 지지의 음양이 맞지 않습니다 (없는 간지)`);
    return s + br;
  });
  return [conv[0], conv[1], conv[2], conv[3] ?? null];
}
/** 만세력 규칙 검사: 연간→월간, 일간→시간 */
export function checkPillars(p: Pillars): string[] {
  const errs: string[] = [];
  const m = STEMS[([2, 4, 6, 8, 0][STEMS.indexOf(p[0][0]) % 5] + ((BRANCHES.indexOf(p[1][1]) - 2 + 12) % 12)) % 10];
  if (m !== p[1][0]) errs.push(`월간 ${p[1][0]} ≠ 계산 ${m}`);
  if (p[3]) {
    const h = STEMS[([0, 2, 4, 6, 8][STEMS.indexOf(p[2][0]) % 5] + BRANCHES.indexOf(p[3][1])) % 10];
    if (h !== p[3][0]) errs.push(`시간 ${p[3][0]} ≠ 계산 ${h}`);
  }
  return errs;
}
export const toKo = (ganji: string): string => STEMS_KO[STEMS.indexOf(ganji[0])] + BRANCHES_KO[BRANCHES.indexOf(ganji[1])];
