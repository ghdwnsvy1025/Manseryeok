// 원본: 사주 코어 core/src/relations.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/충.md (C-01~C-10) + 규칙/삼합.md (S-01~S-09). 합과 충은 서로의 강도를 바꾸므로(C-02 = S-07) 한 파일에서 함께 판정합니다.
// 적용 순서: S-04 → S-01~03 → S-06 → S-07/C-02 → C-03. 세력(%)은 건드리지 않습니다(S-05).
import {
  type Element, type Group, type Pillars, type Role,
  BRANCH_EL, STEM_EL, CTRL, POS_NAME, groupMap, mainStem,
} from "./base";
import type { Balance, Yongsin } from "./yongsin";

type B = { pos: number; ch: string };            // 지지 하나
export type HapLevel = "강" | "중" | "약" | "불성립";
export type HapKind = "삼합" | "방합" | "육합" | "반합";
export type Hap = {
  종류: HapKind; 글자: string[]; 자리: string[]; 오행: Element | null; 단계: HapLevel;
  십신그룹: Group | null; 뜻: string | null; 근거: string[];
};
export type Chung = {
  이름: string; 글자: [string, string]; 자리: [string, string]; 종류: "생지충" | "왕지충" | "고지충";
  기본강도: number; 강도: number; 풀림: boolean;
  위축: { 글자: string; 오행: Element; 역할: Role } | null;
  방향: "불리" | "유리" | "중립" | "해당 없음"; 역전가능: boolean;
  생활기반충: boolean; 월령흔들림: boolean; 영역: string[]; 개고태그: string | null; 근거: string[];
};

const SAMHAP: { 생: string; 왕: string; 고: string; el: Element }[] = [
  { 생: "申", 왕: "子", 고: "辰", el: "수" }, { 생: "亥", 왕: "卯", 고: "未", el: "목" },
  { 생: "寅", 왕: "午", 고: "戌", el: "화" }, { 생: "巳", 왕: "酉", 고: "丑", el: "금" },
];
const BANGHAP: { 글자: string; 왕: string; el: Element }[] = [
  { 글자: "寅卯辰", 왕: "卯", el: "목" }, { 글자: "巳午未", 왕: "午", el: "화" }, { 글자: "申酉戌", 왕: "酉", el: "금" }, { 글자: "亥子丑", 왕: "子", el: "수" },
];
const YUKHAP: Record<string, string> = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
const CHUNG: Record<string, { 상대: string; 종류: Chung["종류"]; 기본: number; 위축: string | null }> = {
  寅: { 상대: "申", 종류: "생지충", 기본: 3, 위축: "寅" }, 申: { 상대: "寅", 종류: "생지충", 기본: 3, 위축: "寅" },
  巳: { 상대: "亥", 종류: "생지충", 기본: 3, 위축: "巳" }, 亥: { 상대: "巳", 종류: "생지충", 기본: 3, 위축: "巳" },
  子: { 상대: "午", 종류: "왕지충", 기본: 3, 위축: "午" }, 午: { 상대: "子", 종류: "왕지충", 기본: 3, 위축: "午" },
  卯: { 상대: "酉", 종류: "왕지충", 기본: 3, 위축: "卯" }, 酉: { 상대: "卯", 종류: "왕지충", 기본: 3, 위축: "卯" },
  辰: { 상대: "戌", 종류: "고지충", 기본: 2, 위축: null }, 戌: { 상대: "辰", 종류: "고지충", 기본: 2, 위축: null },
  丑: { 상대: "未", 종류: "고지충", 기본: 2, 위축: null }, 未: { 상대: "丑", 종류: "고지충", 기본: 2, 위축: null },
};
const STORE: Record<string, Element> = { 辰: "수", 戌: "화", 丑: "금", 未: "목" };
const AREA = ["어린 시절 환경·부모", "사회 환경·직업", "배우자·생활 기반", "자녀·노년"];
const GROUP_MEANING: Record<Group, string> = {
  비겁: "형제·친구·동료 관계가 두터움", 식상: "활동력, 아랫사람과의 관계", 재성: "재물 욕구, 사회적 관계망",
  관성: "조직·직장에 묶이는 삶", 인성: "부모·스승과의 관계, 의존",
};
const LEVELS: HapLevel[] = ["강", "중", "약", "불성립"];
const weaken = (l: HapLevel): HapLevel => LEVELS[Math.min(LEVELS.indexOf(l) + 1, 3)];
const branchesOf = (p: Pillars): B[] => p.flatMap((g, pos) => (g ? [{ pos, ch: g[1] }] : []));
const dist = (a: B, b: B) => Math.abs(a.pos - b.pos);
const name = (b: B) => `${POS_NAME[b.pos]}지`;

type Cand = { 종류: HapKind; members: B[]; el: Element | null; 단계: HapLevel; 왕: B | null; 근거: string[] };

function hapCandidates(bs: B[]): Cand[] {
  const out: Cand[] = []; const find = (ch: string) => bs.filter((b) => b.ch === ch);
  const combos = <T,>(lists: T[][]): T[][] => lists.reduce<T[][]>((acc, l) => acc.flatMap((a) => l.map((x) => [...a, x])), [[]]);
  for (const s of SAMHAP) {
    const full = combos([find(s.생), find(s.왕), find(s.고)]);
    if (full.length) {
      const best = full.map((m) => ({ m, span: Math.max(...m.map((x) => x.pos)) - Math.min(...m.map((x) => x.pos)) })).sort((a, b) => a.span - b.span)[0];
      out.push({ 종류: "삼합", members: best.m, el: s.el, 단계: best.span === 2 ? "강" : "약", 왕: best.m[1], 근거: [best.span === 2 ? "세 글자가 연속된 세 자리" : "세 글자가 있으나 연속 아님"] });
      continue;
    }
    for (const w of find(s.왕)) for (const o of [...find(s.생), ...find(s.고)]) {
      const d = dist(w, o); if (d > 2) continue;
      out.push({ 종류: "반합", members: [w, o], el: s.el, 단계: d === 1 ? "중" : "약", 왕: w, 근거: [`왕지 ${w.ch} + ${o.ch}, ${d === 1 ? "인접" : "한 칸 떨어짐"}`] });
    }
  }
  for (const g of BANGHAP) {
    const full = combos([...g.글자].map(find)).filter((m) => Math.max(...m.map((x) => x.pos)) - Math.min(...m.map((x) => x.pos)) === 2);
    if (full.length) { out.push({ 종류: "방합", members: full[0], el: g.el, 단계: "강", 왕: full[0].find((x) => x.ch === g.왕)!, 근거: ["같은 계절 세 글자가 연속"] }); continue; }
    for (const w of find(g.왕)) for (const o of bs.filter((b) => g.글자.includes(b.ch) && b.ch !== g.왕 && dist(w, b) === 1))
      out.push({ 종류: "방합", members: [w, o], el: g.el, 단계: "약", 왕: w, 근거: [`왕지 ${w.ch} 포함 두 글자 인접`] });
  }
  for (const a of bs) for (const b of bs) {
    if (a.pos >= b.pos || YUKHAP[a.ch] !== b.ch) continue;
    const d = dist(a, b); if (d > 2) continue;
    out.push({ 종류: "육합", members: [a, b], el: null, 단계: d === 1 ? "중" : "약", 왕: null, 근거: [d === 1 ? "인접" : "한 칸 떨어짐"] });
  }
  return out;
}

export type Relations = { 합: Hap[]; 불성립합: Hap[]; 충: Chung[]; 월령흔들림: boolean };

export function relations(p: Pillars, b: Balance, y: Yongsin): Relations {
  const bs = branchesOf(p); const { toGroup } = groupMap(p[2][0]);
  let cands = hapCandidates(bs); const rejected: Cand[] = [];
  // S-04 왕지가 구성원이 아닌 옆 지지에게 극당하면 불성립
  cands = cands.filter((c) => {
    if (!c.왕) return true;
    const attacker = bs.find((x) => dist(x, c.왕!) === 1 && !c.members.includes(x) && CTRL[BRANCH_EL[x.ch]] === BRANCH_EL[c.왕!.ch]);
    if (attacker) { rejected.push({ ...c, 단계: "불성립", 근거: [...c.근거, `S-04: 왕지 ${c.왕.ch} 옆 ${attacker.ch}(${BRANCH_EL[attacker.ch]})가 극함`] }); return false; }
    return true;
  });
  // S-06 우선순위: 완전 삼합 > 방합 > 육합 > 반합
  const prio: Record<HapKind, number> = { 삼합: 0, 방합: 1, 육합: 2, 반합: 3 };
  cands.sort((a, c) => prio[a.종류] - prio[c.종류] || LEVELS.indexOf(a.단계) - LEVELS.indexOf(c.단계));
  const accepted: Cand[] = []; const used = new Set<B>();
  for (const c of cands) {
    if (c.members.some((m) => used.has(m))) { rejected.push({ ...c, 단계: "불성립", 근거: [...c.근거, "S-06: 더 앞선 합에 글자가 이미 묶임"] }); continue; }
    accepted.push(c); c.members.forEach((m) => used.add(m));
  }
  // 충 C-01
  const chungs: { a: B; c: B; info: (typeof CHUNG)[string]; 강도: number; 근거: string[] }[] = [];
  for (const a of bs) for (const c of bs) {
    if (a.pos >= c.pos || CHUNG[a.ch]?.상대 !== c.ch) continue;
    const d = dist(a, c); if (d === 3) continue;
    const info = CHUNG[a.ch];
    chungs.push({ a, c, info, 강도: info.기본 - (d === 2 ? 1 : 0), 근거: [d === 1 ? "인접 → 기본 강도" : "한 칸 떨어짐 → 강도 −1"] });
  }
  // C-02 = S-07 합과 충이 같은 글자에 걸릴 때
  for (const ch of chungs) for (const h of [...accepted]) {
    const shared = h.members.filter((m) => m === ch.a || m === ch.c); if (!shared.length || h.단계 === "불성립") continue;
    const dc = dist(ch.a, ch.c);
    const dh = Math.min(...shared.flatMap((s) => h.members.filter((m) => m !== s && m !== ch.a && m !== ch.c).map((m) => dist(s, m))));
    if (!isFinite(dh)) continue;
    const label = `${h.종류} ${h.members.map((m) => m.ch).join("")}`;
    if (dh < dc) { ch.강도 -= 2; ch.근거.push(`C-02: ${label}이 더 가까움 → 강도 −2`); }
    else if (dh === dc) { ch.강도 -= 1; h.단계 = weaken(h.단계); ch.근거.push(`C-02: ${label}과 같은 거리 → 강도 −1`); h.근거.push(`S-07: ${ch.a.ch}${ch.c.ch}충과 같은 거리 → 한 단계 약해짐`); }
    else { h.단계 = h.종류 === "삼합" ? weaken(h.단계) : "불성립"; h.근거.push(`S-07: ${ch.a.ch}${ch.c.ch}충이 더 가까움`); }
  }
  // C-03 통관
  for (const ch of chungs) {
    const els = new Set([BRANCH_EL[ch.a.ch], BRANCH_EL[ch.c.ch]]);
    const bridge: Element | null = els.has("수") && els.has("화") ? "목" : els.has("금") && els.has("목") ? "수" : null;
    if (!bridge) continue;
    const has = [ch.a, ch.c].some((m) => STEM_EL[p[m.pos]![0]] === bridge || bs.some((x) => x !== ch.a && x !== ch.c && dist(x, m) === 1 && BRANCH_EL[x.ch] === bridge));
    if (has) { ch.강도 -= 1; ch.근거.push(`C-03: 통관하는 ${bridge}이(가) 곁에 있음 → 강도 −1`); }
  }
  const pct = b.판정용퍼센트;
  const 충: Chung[] = chungs.map((ch) => {
    const 강도 = Math.max(0, ch.강도); const w = ch.info.위축; const other = w === ch.a.ch ? ch.c.ch : ch.a.ch;
    const 위축 = w ? { 글자: w, 오행: BRANCH_EL[w], 역할: y.오행역할[BRANCH_EL[w]] } : null;
    const 역전가능 = !!w && pct[BRANCH_EL[w]] >= 3 * pct[BRANCH_EL[other]];
    const 방향 = !위축 ? "해당 없음" : "용희".includes(위축.역할) ? "불리" : "기구".includes(위축.역할) ? "유리" : "중립";
    let 개고태그: string | null = null;
    if (!w) for (const m of [ch.a, ch.c]) {
      const el = STORE[m.ch]; if (p.some((g) => g && STEM_EL[g[0]] === el)) continue;
      const r = y.오행역할[el]; 개고태그 = `개고: ${m.ch} 속 ${el} 드러남${"용희".includes(r) ? " → 기회" : "기구".includes(r) ? " → 손실 주의" : ""}`; break;
    }
    const 기반 = [ch.a, ch.c].some((m) => m.pos === 1 || m.pos === 2);
    return {
      이름: `${ch.a.ch}${ch.c.ch}충`, 글자: [ch.a.ch, ch.c.ch], 자리: [name(ch.a), name(ch.c)], 종류: ch.info.종류,
      기본강도: ch.info.기본, 강도, 풀림: 강도 === 0, 위축, 방향: 역전가능 ? "중립" : 방향, 역전가능,
      생활기반충: 기반, 월령흔들림: 강도 > 0 && [ch.a, ch.c].some((m) => m.pos === 1), 영역: [AREA[ch.a.pos], AREA[ch.c.pos]], 개고태그, 근거: ch.근거,
    };
  });
  const toHap = (c: Cand): Hap => ({
    종류: c.종류, 글자: c.members.map((m) => m.ch), 자리: c.members.map(name), 오행: c.el, 단계: c.단계,
    십신그룹: c.el ? toGroup[c.el] : null, 뜻: c.el && c.단계 !== "불성립" ? GROUP_MEANING[toGroup[c.el]] : null, 근거: c.근거,
  });
  const all = accepted.map(toHap);
  return { 합: all.filter((h) => h.단계 !== "불성립"), 불성립합: [...all.filter((h) => h.단계 === "불성립"), ...rejected.map(toHap)], 충, 월령흔들림: 충.some((c) => c.월령흔들림) };
}

// ---------- 운 ----------
export type LuckRelations = { 충: { 상대: string; 자리: string; 강도: number; 방향: string; 위축: string | null; 월령흔들림: boolean }[]; 합: { 종류: string; 글자: string; 단계: HapLevel; 오행: Element | null; 근거: string }[]; 플래그: string[] };
const SEAT = [1, 3, 3, 2]; // 연 월 일 시

/** C-08 운 지지 ↔ 원국 지지, S-08 운에서 오는 합. enginePct = 엔진 originalPercentage(없으면 판정용 %) */
export function luckRelations(p: Pillars, luckGanji: string, b: Balance, y: Yongsin, natal: Relations, enginePct?: Record<Element, number>): LuckRelations {
  const bs = branchesOf(p); const L = luckGanji[1]; const pct = enginePct ?? b.판정용퍼센트; const 플래그: string[] = [];
  const 충 = bs.filter((x) => CHUNG[L]?.상대 === x.ch).map((x) => {
    const info = CHUNG[L]; const w = info.위축; const role = w ? y.오행역할[BRANCH_EL[w]] : null;
    return { 상대: x.ch, 자리: name(x), 강도: SEAT[x.pos] - (info.종류 === "고지충" ? 1 : 0), 위축: w,
      방향: !role ? "해당 없음" : "용희".includes(role) ? "불리" : "기구".includes(role) ? "유리" : "중립", 월령흔들림: x.pos === 1 };
  });
  const 합: LuckRelations["합"] = []; const has = (ch: string) => bs.some((x) => x.ch === ch);
  for (const s of SAMHAP) {
    if (![s.생, s.왕, s.고].includes(L)) continue;
    const others = [s.생, s.왕, s.고].filter((c) => c !== L); const have = others.filter(has);
    if (have.length === 2) 합.push({ 종류: "삼합", 글자: s.생 + s.왕 + s.고, 단계: "강", 오행: s.el, 근거: "원국 두 글자 + 운이 나머지 한 글자" });
    else if (L === s.왕 && have.length === 1) 합.push({ 종류: "반합", 글자: have[0] + L, 단계: "약", 오행: s.el, 근거: "운이 왕지로 옴 (조금 강해지는 정도)" });
    else if (L !== s.왕 && has(s.왕)) {
      const ok = pct[s.el] >= 30;
      합.push({ 종류: "반합", 글자: s.왕 + L, 단계: ok ? "중" : "불성립", 오행: s.el, 근거: ok ? `원국 ${s.el} ${Math.round(pct[s.el])}% ≥ 30` : `원국 ${s.el} ${Math.round(pct[s.el])}% < 30 → 운 글자는 본래 오행대로` });
    }
  }
  for (const x of bs) if (YUKHAP[L] === x.ch) {
    합.push({ 종류: "육합", 글자: L + x.ch, 단계: "중", 오행: null, 근거: `${name(x)}와 육합 (세력 변화 없음)` });
    for (const c of natal.충) if (!c.풀림 && c.글자.includes(x.ch)) 플래그.push(`긴장이 풀리는 시기: 운 ${L}이 ${x.ch}와 합해 원국 ${c.이름}을 늦춤`);
  }
  if (충.some((c) => c.월령흔들림)) 플래그.push("월령 흔들림 (격국.md 파격 조건의 형충)");
  return { 충, 합: 합, 플래그 };
}

/** C-09 대운 ↔ 세운 */
export function luckClash(daeun: string, seun: string): { 충: boolean; 강도: number; 최고경보: boolean } {
  const 충 = CHUNG[daeun[1]]?.상대 === seun[1];
  const se = STEM_EL[daeun[0]], te = STEM_EL[seun[0]];
  return { 충, 강도: 충 ? 3 : 0, 최고경보: 충 && (CTRL[se] === te || CTRL[te] === se) };
}
export { mainStem };
