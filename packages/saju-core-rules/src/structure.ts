// 원본: 사주 코어 core/src/structure.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/구조.md — T존(K-01)·통근(K-02)·투출(K-03)·간여지동(K-04)·고립 후보(K-05)·흐름(K-06)·용신과 기신의 처지(K-07)·자리별 태그(K-08)
import {
  type Element, type Group, type Pillars, type Node, type TenGod, type Role,
  STEM_EL, BRANCH_EL, HIDDEN, GEN, GEN_BY, CTRL, CTRL_BY, GROUPS, POS_NAME,
  mainStem, nodesOf, adjacent, isDayStem, nodeName, tenGod,
} from "./base";
import type { Balance, Yongsin } from "./yongsin";

export type RootGrade = "강" | "중" | "약" | "무근";
const STEM_COMBINE: Record<string, string> = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };
const SIX_COMBINE: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };

/** K-02 통근: 자기 지지의 정기=강, 중기=중, 여기=약. 인접 기둥 지지는 한 등급 낮춰 최대 "약" */
export function rootGrade(p: Pillars, pos: number): { 등급: RootGrade; 근거: string } {
  const stem = p[pos]![0]; const helper = new Set<Element>([STEM_EL[stem], GEN_BY[STEM_EL[stem]]]);
  const gradeIn = (branch: string): RootGrade => {
    const h = [...HIDDEN[branch]]; const idx = h.map((s, i) => (helper.has(STEM_EL[s]) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return "무근";
    const best = Math.max(...idx);
    return best === h.length - 1 ? "강" : h.length === 3 && best === 1 ? "중" : "약";
  };
  const own = gradeIn(p[pos]![1]);
  if (own !== "무근") return { 등급: own, 근거: `자기 지지 ${p[pos]![1]}(${HIDDEN[p[pos]![1]]})` };
  for (const q of [pos - 1, pos + 1]) {
    if (q < 0 || q > 3 || !p[q]) continue;
    const g = gradeIn(p[q]![1]);
    if (g === "강" || g === "중") return { 등급: "약", 근거: `인접한 ${POS_NAME[q]}지 ${p[q]![1]}에 뿌리 (한 등급 낮춤)` };
  }
  return { 등급: "무근", 근거: "자기 지지와 인접 지지에 뿌리 없음" };
}

export type TzoneItem = { 자리: string; 글자: string; 십신: TenGod; 그룹: Group; 의미: string; 통근?: RootGrade; 극당함: boolean; 극한글자?: string[] };   // 극한글자: 누가 누르는지 — 예 "시지 午(화, 바로 아래)". 2026-09-29 글에 "옆 글자에게 눌려"로만 나가 실제로는 아래 글자인데 옆이라고 쓴 일이 있었음
/** K-01 T존 = 시간 · 일지 · 월간 */
export function tzone(p: Pillars): { 항목: TzoneItem[]; 완전: boolean } {
  const day = p[2][0]; const N = nodesOf(p);
  const hit = (n: Node) => N.some((m) => adjacent(n, m) && CTRL[m.el] === n.el);
  const who = (n: Node) => N.filter((m) => adjacent(n, m) && CTRL[m.el] === n.el)
    .map((m) => `${nodeName(m)}(${m.el}, ${m.pos === n.pos ? (n.kind === "간" ? "바로 아래" : "바로 위") : "바로 옆"})`);
  const find = (kind: "간" | "지", pos: number) => N.find((n) => n.kind === kind && n.pos === pos)!;
  const 항목: TzoneItem[] = [];
  if (p[3]) { const t = tenGod(day, p[3][0]); 항목.push({ 자리: "시간", 글자: p[3][0], 십신: t.god, 그룹: t.group, 의미: "계발할 도구·가장 순수한 욕망", 통근: rootGrade(p, 3).등급, 극당함: hit(find("간", 3)), 극한글자: who(find("간", 3)) }); }
  { const t = tenGod(day, mainStem(p[2][1])); 항목.push({ 자리: "일지", 글자: p[2][1], 십신: t.god, 그룹: t.group, 의미: "현실 태도·활동 무대·배우자 자리", 극당함: hit(find("지", 2)), 극한글자: who(find("지", 2)) }); }
  { const t = tenGod(day, p[1][0]); 항목.push({ 자리: "월간", 글자: p[1][0], 십신: t.god, 그룹: t.group, 의미: "타고난 도구", 통근: rootGrade(p, 1).등급, 극당함: hit(find("간", 1)), 극한글자: who(find("간", 1)) }); }
  return { 항목, 완전: !!p[3] };
}

/** K-03 투출: 지장간 글자가 똑같은 글자로 천간에 있음 */
export function exposed(p: Pillars): { 지지: string; 자리: string; 글자: string; 천간자리: string[] }[] {
  const out = [];
  for (let i = 0; i < 4; i++) {
    if (!p[i]) continue;
    for (const s of HIDDEN[p[i]![1]]) {
      const where = p.map((g, j) => (g && g[0] === s ? POS_NAME[j] + "간" : "")).filter(Boolean);
      if (where.length) out.push({ 지지: p[i]![1], 자리: POS_NAME[i] + "지", 글자: s, 천간자리: where });
    }
  }
  return out;
}

/** K-04 간여지동 */
export const sameElementPillars = (p: Pillars): { 자리: string; 간지: string; 태그: string }[] =>
  p.flatMap((g, i) => (g && STEM_EL[g[0]] === BRANCH_EL[g[1]]
    ? [{ 자리: POS_NAME[i] + "주", 간지: g, 태그: i === 2 ? "자기주장·실천력 강함, 장단점 모두 크게 드러남" : "그 십신의 힘이 강함" }] : []));

/** K-05 고립 후보 — 검증상 기준선과 같아 확신도 "낮음". 용신 등급에 쓰지 않음 */
export function isolatedCandidates(p: Pillars): Node[] {
  const N = nodesOf(p); const res: Node[] = [];
  for (const x of N) {
    if (isDayStem(x)) continue;
    if (N.filter((y) => y.el === x.el && !isDayStem(y)).length !== 1) continue;
    const nb = N.filter((y) => adjacent(x, y)); const helper = new Set<Element>([x.el, GEN_BY[x.el]]); const attacker = CTRL_BY[x.el];
    let hit: boolean;
    if (x.kind === "간") {
      const own = [...HIDDEN[p[x.pos]![1]]];
      if (own.some((h) => helper.has(STEM_EL[h]))) continue;
      if (nb.some((y) => y.kind === "간" && helper.has(y.el))) continue;
      hit = own.some((h) => STEM_EL[h] === attacker) || nb.some((y) => y.el === attacker);
    } else {
      if (nb.some((y) => helper.has(y.el))) continue;
      hit = nb.some((y) => y.el === attacker);
    }
    if (hit) res.push(x);
  }
  return res;
}

/** K-06 흐름: 인접 그물에서 상생 링크를 따라 가장 긴 사슬. 3단계 이상이면 흐름 있음 */
export function flow(p: Pillars): { 사슬: Element[]; 단계: number; 흐름: boolean; 시작: string; 일간포함: boolean } {
  const N = nodesOf(p); let best: Node[] = []; let bestEls: Element[] = [];
  const dfs = (x: Node, els: Element[], path: Node[], seen: Set<Node>) => {
    if (els.length > bestEls.length) { bestEls = [...els]; best = [...path]; }
    for (const y of N) {
      if (seen.has(y) || !adjacent(x, y)) continue;
      if (y.el === x.el) { seen.add(y); dfs(y, els, [...path, y], seen); seen.delete(y); }
      else if (GEN[x.el] === y.el) { seen.add(y); dfs(y, [...els, y.el], [...path, y], seen); seen.delete(y); }
    }
  };
  for (const x of N) dfs(x, [x.el], [x], new Set([x]));
  const 단계 = bestEls.length - 1;
  return { 사슬: bestEls, 단계, 흐름: 단계 >= 3, 시작: best.length ? nodeName(best[0]) : "", 일간포함: best.some(isDayStem) };
}

/** K-07 용신과 기신의 처지 + 희신의 위치(A/B 유형) */
export function yongGiSituation(p: Pillars, b: Balance, y: Yongsin): { 태그: string[]; 희신: string | null; 근거: string[] } {
  const N = nodesOf(p).filter((n) => !isDayStem(n)); const roleOf = (n: Node): Role => y.오행역할[n.el];
  const Y = N.filter((n) => roleOf(n) === "용"), G = N.filter((n) => roleOf(n) === "기"), H = N.filter((n) => roleOf(n) === "희");
  const 태그: string[] = []; const 근거: string[] = [];
  if (!Y.length) { 태그.push("용신 부재"); if (H.length) 태그.push("희신이 대행"); if (G.length) 태그.push("할 일 없는 기신"); }
  else if (G.length) {
    const pairs = Y.flatMap((a) => G.filter((g) => adjacent(a, g)).map((g) => [a, g] as const));
    if (!pairs.length) 태그.push("거리 있음");
    for (const [a, g] of pairs) {
      const allied = (a.kind === "간" && g.kind === "간" && STEM_COMBINE[a.ch] === g.ch) || (a.kind === "지" && g.kind === "지" && SIX_COMBINE[a.ch] === g.ch);
      태그.push(allied ? "연합" : "기신이 용신 곁에 있음"); 근거.push(`${nodeName(g)} ↔ ${nodeName(a)}${allied ? " (합)" : ""}`);
    }
  }
  let 희신: string | null = null;
  if (H.length) {
    const strongEl = b.그룹오행[b.중심기운]; const S = nodesOf(p).filter((n) => n.el === strongEl);
    const near = H.some((h) => S.some((s) => adjacent(h, s)));
    const typeA = ["식상", "재성", "인성"].includes(b.중심기운);
    const day = nodesOf(p).find(isDayStem)!;
    희신 = typeA ? (near ? "난처한 희신" : "편안한 희신") : near ? (H.some((h) => adjacent(h, day)) || b.중심기운 !== "비겁" ? "절묘한 희신" : "아쉬운 희신") : "아쉬운 희신";
  }
  return { 태그: [...new Set(태그)], 희신, 근거 };
}

/** K-08 자리별 태그 (일반론. 최종 유불리는 용신 기준) */
export function positionTags(p: Pillars): { 자리: string; 좋은: string[]; 꺼리는: string[] }[] {
  const s = (i: number) => (p[i] ? STEM_EL[p[i]![0]] : null), br = (i: number) => (p[i] ? BRANCH_EL[p[i]![1]] : null);
  const gen = (a: Element | null, c: Element | null) => !!a && !!c && GEN[a] === c, ctl = (a: Element | null, c: Element | null) => !!a && !!c && CTRL[a] === c;
  const rows: { 자리: string; 좋은: string[]; 꺼리는: string[] }[] = [];
  const add = (자리: string, 좋은: (string | false)[], 꺼리는: (string | false)[]) => rows.push({ 자리, 좋은: 좋은.filter(Boolean) as string[], 꺼리는: 꺼리는.filter(Boolean) as string[] });
  add("연간", [gen(s(0), s(1)) && "월간을 생함", rootGrade(p, 0).등급 !== "무근" && "연지에 통근"], [ctl(s(0), s(1)) && "월간을 극함", ctl(br(0), s(0)) && "연지에 극당함"]);
  add("연지", [gen(br(0), br(1)) && "월지를 생함"], [ctl(br(0), br(1)) && "월지를 극함"]);
  add("월간", [], [ctl(br(1), s(1)) && "월지에게 극받음"]);
  add("월지", [], [ctl(br(1), br(2)) && "일지를 극함", ctl(br(1), s(1)) && "월간을 극함"]);
  if (p[3]) {
    add("시간", [(gen(br(3), s(3)) || gen(s(3), br(3)) || s(3) === br(3)) && "시지와 생·같은 오행"], [ctl(br(3), s(3)) && "시지에게 극받음"]);
    add("시지", [], [ctl(br(3), s(3)) && "시간을 극함", ctl(br(3), br(2)) && "일지를 극함"]);
  }
  return rows.filter((r) => r.좋은.length || r.꺼리는.length);
}
export { GROUPS };
