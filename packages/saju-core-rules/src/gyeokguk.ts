// 원본: 사주 코어 core/src/gyeokguk.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/격국.md — 격 정하기(G-01~G-04), 성격·파격·구응(G-05·G-06, 원전 판정/거리 판정 이중 출력), 운에서의 격(G-07)
import {
  type Group, type Pillars, type TenGod,
  STEMS, STEM_EL, BRANCH_EL, HIDDEN, POS_NAME, tenGod, isYang, mainStem, groupOfGod,
} from "./base";
import type { Balance } from "./yongsin";
import type { Relations } from "./relations";

const ROK: Record<string, string> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
const YANGIN: Record<string, string> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" };
const COMBINE: Record<string, string> = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };

export type GyeokName = "정관격" | "칠살격" | "재격" | "인격" | "식신격" | "상관격" | "건록격" | "양인격" | "월겁격";
export type Verdict = "성격" | "파격" | "파격-구응" | "판정보류";
export type Gyeok = {
  격: GyeokName; 격글자: string; 격십신: TenGod; 용법: "순용" | "역용";
  정한방법: string; 겸격: string[]; 보조격: string | null; 표시: string[];
  원전판정: Judged; 거리판정: Judged; 학파차이: boolean; 확신도: "높음" | "보통";
};
export type Judged = { 판정: Verdict; 성격근거: string[]; 파격사유: string[]; 구응: string[]; 약한공격: string[] };

type L = { kind: "간" | "지"; pos: number; stem: string; god: TenGod; group: Group; label: string }; // pos −1 = 운(모든 자리와 인접)
const adj = (a: L, b: L) => a.pos === -1 || b.pos === -1 || (a.pos === b.pos && a.kind !== b.kind) || (a.kind === b.kind && Math.abs(a.pos - b.pos) === 1);
const oneApart = (a: L, b: L) => a.pos >= 0 && b.pos >= 0 && a.kind === b.kind && Math.abs(a.pos - b.pos) === 2;

function letters(p: Pillars, luck?: string): L[] {
  const day = p[2][0]; const out: L[] = [];
  const push = (kind: "간" | "지", pos: number, ch: string, label: string) => { const stem = kind === "간" ? ch : mainStem(ch); const t = tenGod(day, stem); out.push({ kind, pos, stem, god: t.god, group: t.group, label }); };
  p.forEach((g, i) => { if (!g) return; if (i !== 2) push("간", i, g[0], `${POS_NAME[i]}간 ${g[0]}`); push("지", i, g[1], `${POS_NAME[i]}지 ${g[1]}`); });
  if (luck) { push("간", -1, luck[0], `운 ${luck[0]}`); push("지", -1, luck[1], `운 ${luck[1]}`); }
  return out;
}

function nameOf(god: TenGod): { 격: GyeokName; 용법: "순용" | "역용" } {
  const m: Record<TenGod, GyeokName> = { 정관: "정관격", 편관: "칠살격", 정재: "재격", 편재: "재격", 정인: "인격", 편인: "인격", 식신: "식신격", 상관: "상관격", 비견: "월겁격", 겁재: "월겁격" };
  const 격 = m[god]; return { 격, 용법: ["정관격", "재격", "인격", "식신격"].includes(격) ? "순용" : "역용" };
}

/** G-01~G-04 격 정하기 */
export function decideGyeok(p: Pillars, rel: Relations): Pick<Gyeok, "격" | "격글자" | "격십신" | "용법" | "정한방법" | "겸격" | "보조격" | "표시"> {
  const day = p[2][0]; const mb = p[1][1]; const hidden = [...HIDDEN[mb]]; const main = hidden.at(-1)!; const 표시: string[] = [];
  const stems = p.map((g, i) => (g && i !== 2 ? { pos: i, ch: g[0] } : null)).filter(Boolean) as { pos: number; ch: string }[];
  const combinedAway = (s: { pos: number; ch: string }) => stems.some((o) => Math.abs(o.pos - s.pos) === 1 && COMBINE[s.ch] === o.ch);
  // G-01
  const g01: GyeokName | null = ROK[day] === mb ? "건록격" : isYang(day) && YANGIN[day] === mb ? "양인격" : !isYang(day) && tenGod(day, main).god === "겁재" && !"辰戌丑未".includes(mb) ? "월겁격" : null;
  if (g01) {
    const cands = stems.map((s) => ({ s, t: tenGod(day, s.ch) })).filter((x) => ["정재", "편재", "정관", "편관", "식신"].includes(x.t.god));
    const roots = (ch: string) => p.filter((g) => g && [...HIDDEN[g[1]]].some((h) => STEM_EL[h] === STEM_EL[ch])).length;
    cands.sort((a, b) => roots(b.s.ch) - roots(a.s.ch));
    return { 격: g01, 격글자: main, 격십신: tenGod(day, main).god, 용법: "역용", 정한방법: "G-01 십간 록·양인 표", 겸격: [], 보조격: cands[0] ? `${cands[0].t.god}(${cands[0].s.ch})` : null, 표시 };
  }
  const finish = (ch: string, how: string, 겸격: string[] = []) => {
    const god = tenGod(day, ch).god; const n = nameOf(god);
    if (n.격 === "월겁격") 표시.push("격 글자가 비겁 → 월겁격으로 처리 (규칙에 명시 없는 경우)");
    return { ...n, 격글자: ch, 격십신: god, 정한방법: how, 겸격, 보조격: null, 표시 };
  };
  const japgi = "辰戌丑未".includes(mb);
  if (japgi) {                                                                                       // G-03
    const sam = rel.합.find((h) => h.종류 === "삼합" && h.자리.includes("월지"));
    if (sam) return finish(hidden[1], `G-03 월지를 포함한 완전 삼합(${sam.글자.join("")}) → 월지 중기`);
    const bang = rel.합.find((h) => h.종류 === "방합" && h.글자.length === 3 && h.자리.includes("월지"));
    if (bang) return finish(hidden[0], `G-03 월지를 포함한 완전 방합(${bang.글자.join("")}) → 월지 여기`);
  } else if (rel.합.some((h) => h.종류 === "삼합" && h.자리.includes("월지"))) 표시.push("자평진전_변화가능");
  // G-02 / G-03 투출
  const isExposed = (h: string) => stems.filter((s) => (japgi ? STEM_EL[s.ch] === STEM_EL[h] : s.ch === h)).some((s) => !combinedAway(s));
  const usable = hidden.filter((h, i) => tenGod(day, h).group !== "비겁" && !(!japgi && "寅申巳亥".includes(mb) && i === 0 && h === "戊"));
  const ex = usable.filter(isExposed);
  if (ex.includes(main)) return finish(main, "정기가 천간에 드러남", ex.filter((h) => h !== main).map((h) => `${tenGod(day, h).god}(${h})`));
  if (ex.length === 1) return finish(ex[0], `정기는 안 드러나고 ${ex[0]}만 드러남`);
  if (ex.length > 1) {
    const roots = (ch: string) => p.filter((g) => g && [...HIDDEN[g[1]]].some((h) => STEM_EL[h] === STEM_EL[ch])).length;
    const pick = [...ex].sort((a, b) => roots(b) - roots(a) || hidden.indexOf(b) - hidden.indexOf(a))[0];
    return finish(pick, "중기·여기가 함께 드러남 → 뿌리가 많은 쪽(같으면 중기)", ex.filter((h) => h !== pick).map((h) => `${tenGod(day, h).god}(${h})`));
  }
  return finish(main, "드러난 것이 없어 월지 정기");
}

/** G-05 성격·파격·구응. mode = "원전"(거리 안 봄) | "거리"(인접해야 공격·구응 인정) */
function judge(p: Pillars, g: { 격: GyeokName; 격글자: string }, b: Balance, rel: Relations, mode: "원전" | "거리", luck?: string): Judged {
  const LS = letters(p, luck); const day = p[2][0];
  const of = (...gods: (TenGod | Group)[]) => LS.filter((l) => gods.includes(l.god) || gods.includes(l.group));
  const has = (...x: (TenGod | Group)[]) => of(...x).length > 0;
  const shown = (...x: (TenGod | Group)[]) => of(...x).filter((l) => l.kind === "간");
  const 약한공격: string[] = [];
  const attacks = (as: L[], ts: L[]): L[] => as.filter((a) => {
    if (mode === "원전") return ts.length > 0;
    if (ts.some((t) => adj(a, t))) return true;
    if (ts.some((t) => oneApart(a, t))) 약한공격.push(`${a.label}이(가) 한 칸 떨어져 약하게 공격`);
    return false;
  });
  const blockedBy = (attackers: L[], ...blockers: (TenGod | Group)[]): string[] =>
    of(...blockers).filter((k) => mode === "원전" || attackers.some((a) => adj(k, a))).map((k) => `${k.label}(${k.god})이(가) 막음`);
  const takenAway = (ls: L[]): string[] => ls.filter((l) => l.kind === "간" && LS.some((o) => o.kind === "간" && o !== l && adj(o, l) && COMBINE[l.stem] === o.stem)).map((l) => `${l.label}이(가) 합거됨`);
  const strong = b.신강약 === "신강", weak = b.신강약 === "신약";
  const amt = (grp: Group) => b.양[grp];
  // 격 글자의 위치: 천간에 드러나 있으면 그 자리, 아니면 월지
  const gLetters = LS.filter((l) => l.stem === g.격글자 && l.kind === "간"); const target = gLetters.length ? gLetters : LS.filter((l) => l.kind === "지" && l.pos === 1);
  const ok: string[] = [], bad: string[] = [], save: string[] = [];
  const monthClash = rel.월령흔들림;
  switch (g.격) {
    case "정관격": {
      if (has("재성") || has("인성")) ok.push("재성이나 인성이 함께 있음");
      const a = attacks(of("상관"), target); if (a.length) { bad.push(`상관이 정관을 공격 (${a.map((x) => x.label).join(", ")})`); save.push(...blockedBy(a, "인성")); }
      if (monthClash) bad.push("월지 충");
      const mix = shown("편관"); if (mix.length) { bad.push("편관도 드러남 (관살혼잡)"); save.push(...takenAway(mix)); }
      if (takenAway(target).length) bad.push("정관이 합거됨");
      break;
    }
    case "재격": {
      if (has("관성") && strong) ok.push("재가 관을 생하고 신강"); if (has("식상") && strong) ok.push("식상이 재를 생하고 신강");
      const ins = shown("인성"); if (ins.length && !ins.some((i) => of("재성").some((j) => adj(i, j)))) ok.push("인이 드러났지만 재와 떨어져 있음");
      if (amt("재성") === "약함" && amt("비겁") === "강함") { bad.push("재가 약한데 비겁이 많음"); save.push(...blockedBy(of("비겁"), "식상", "관성")); }
      const k = shown("편관"); if (k.length) { bad.push("칠살이 드러남"); save.push(...blockedBy(k, "식신")); }
      break;
    }
    case "인격": {
      if (amt("인성") === "약함" && has("편관")) ok.push("인이 약한데 칠살이 생해 줌"); if (has("정관")) ok.push("정관과 인이 함께 있음");
      if (strong && amt("인성") === "강함" && has("식상")) ok.push("신강·인강인데 식상으로 기운을 뺌");
      const a = amt("인성") === "약함" ? attacks(of("재성"), target) : (attacks(of("재성"), target), []);
      if (a.length) { bad.push("인이 약한데 재가 인을 공격"); save.push(...blockedBy(a, "겁재", "비견"), ...takenAway(a)); }
      if (strong && amt("인성") === "강함" && shown("편관").length) bad.push("신강·인 많은데 칠살까지 드러남");
      break;
    }
    case "식신격": {
      if (has("재성")) ok.push("식신이 재를 생함"); else if (has("편관")) ok.push("재 없이 식신이 칠살을 누름");
      const a = attacks(of("편인"), target); if (a.length) { bad.push("편인이 식신을 공격 (도식)"); save.push(...blockedBy(a, "재성")); }
      if (has("재성") && shown("편관").length) bad.push("식신생재인데 칠살이 드러남");
      break;
    }
    case "칠살격": {
      if (has("식신") && !weak) ok.push("식신이 칠살을 누름"); if (has("인성") && weak) ok.push("인성이 칠살을 받아 흘림");
      if (has("재성") && !has("식신") && !has("인성")) bad.push("재가 칠살을 생하는데 누르는 것이 없음");
      if (weak && amt("관성") === "강함" && !has("인성") && !has("식신")) bad.push("신약한데 칠살만 강함");
      break;
    }
    case "상관격": {
      if (has("재성") && strong) ok.push("상관이 재를 생함 (신강)");
      if (amt("식상") === "강함" && of("인성").some((l) => l.kind === "지" || p.some((q) => q && [...HIDDEN[q[1]]].some((h) => STEM_EL[h] === STEM_EL[l.stem])))) ok.push("상관이 강하고 인성이 뿌리 있게 누름 (상관패인)");
      if (weak && shown("편관").length && shown("인성").length) ok.push("신약한데 칠살과 인이 함께 드러남");
      const geumsu = STEM_EL[day] === "금" && "亥子丑".includes(p[1][1]);
      const jg = shown("정관");
      if (jg.length && geumsu) ok.push("금수상관 — 정관(화)이 있어도 파격 아님");
      else if (jg.length) { bad.push("정관이 드러남 (상관견관)"); save.push(...blockedBy(of("상관"), "인성")); }
      if (has("재성") && has("편관") && weak) { bad.push("상관생재인데 칠살 있고 신약"); save.push(...takenAway(shown("편관"))); }
      break;
    }
    case "양인격": {
      const gw = shown("관성");
      if (!gw.length) bad.push("정관·편관이 드러나지 않음");
      else if (has("상관")) { bad.push("관이 있으나 상관도 있음"); save.push(...blockedBy(of("상관"), "인성")); }
      else if (has("재성") || has("인성")) ok.push("관이 양인을 누르고 재·인이 받쳐 줌");
      break;
    }
    default: { // 건록격·월겁격
      if (shown("정관").length && (has("재성") || has("인성"))) ok.push("관이 드러나고 재·인이 받쳐 줌");
      if (shown("재성").length && has("식상")) ok.push("재가 드러나고 식상이 생해 줌");
      if (shown("편관").length && has("식신")) ok.push("칠살이 드러나고 식신이 누름");
      if (!has("재성") && !has("관성")) bad.push("재·관이 모두 없음");
      const sh = LS.filter((l) => l.kind === "간" && l.group !== "비겁");
      if (sh.length && sh.every((l) => l.god === "편관" || l.group === "인성") && shown("편관").length) bad.push("칠살과 인만 드러남");
    }
  }
  const 판정: Verdict = bad.length ? (save.length ? "파격-구응" : "파격") : ok.length ? "성격" : "판정보류";
  return { 판정, 성격근거: ok, 파격사유: bad, 구응: [...new Set(save)], 약한공격: [...new Set(약한공격)] };
}

export function gyeokguk(p: Pillars, b: Balance, rel: Relations): Gyeok {
  const d = decideGyeok(p, rel); const 원전판정 = judge(p, d, b, rel, "원전"), 거리판정 = judge(p, d, b, rel, "거리");
  const 학파차이 = 원전판정.판정 !== 거리판정.판정;
  return { ...d, 원전판정, 거리판정, 학파차이, 확신도: 학파차이 || b.경계 ? "보통" : "높음" };
}

/** G-07 운에서의 격 (경고·설명용. 운의 길흉은 용신이 정함) */
export function gyeokInLuck(p: Pillars, b: Balance, rel: Relations, natal: Gyeok, luck: string, monthShaken: boolean): { 판정: Verdict; 태그: string | null; 근거: string[] } {
  const j = judge(p, natal, b, rel, "거리", luck); const before = natal.거리판정.판정;
  const 태그 = monthShaken ? "월령 흔들림" : before === "성격" && j.판정.startsWith("파격") ? "격이 흔들리는 시기" : before === "파격" && j.판정 !== "파격" ? "회복의 시기" : null;
  return { 판정: j.판정, 태그, 근거: [...j.파격사유, ...j.구응] };
}
export { STEMS, BRANCH_EL, groupOfGod };
