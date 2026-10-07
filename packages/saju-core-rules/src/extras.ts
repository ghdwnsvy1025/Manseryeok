// 원본: 사주 코어 core/src/extras.ts @ 240c91dbe54a60059d42b74148db88a31aebd16d (2026-10-07 복사, 이전 ebf972d). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/부가태그.md (판정에 쓰지 않는 태그) + 규칙/조후.md (J-01~J-03 보조 태그)
import { type Element, type Pillars, type Role, STEMS, BRANCHES, STEM_EL, BRANCH_EL, POS_NAME } from "./base";
import type { Yongsin } from "./yongsin";

export type Tag = { 태그: string; 대상: string; 인접: "인접" | "떨어짐" | null; 노트입장: string };

const G60 = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);
const NOBLE: Record<string, string> = { 甲: "丑未", 戊: "丑未", 庚: "丑未", 乙: "子申", 己: "子申", 丙: "亥酉", 丁: "亥酉", 辛: "寅午", 壬: "巳卯", 癸: "巳卯" };
const SAMHAP_OF = (b: string) => ["寅午戌", "申子辰", "巳酉丑", "亥卯未"].find((g) => g.includes(b))!;
const DOHWA: Record<string, string> = { 寅午戌: "卯", 申子辰: "酉", 巳酉丑: "午", 亥卯未: "子" };
const YEOKMA: Record<string, string> = { 寅午戌: "申", 申子辰: "寅", 巳酉丑: "亥", 亥卯未: "巳" };
const HWAGAE: Record<string, string> = { 寅午戌: "戌", 申子辰: "辰", 巳酉丑: "丑", 亥卯未: "未" };
const BAEKHO = ["甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"], GOEGANG = ["庚辰", "庚戌", "壬辰", "戊戌"];
const PAIRS: Record<string, { list: string[]; 노트: string }> = {
  원진: { list: ["子未", "丑午", "寅酉", "卯申", "辰亥", "巳戌"], 노트: "배제" },
  귀문: { list: ["子酉", "丑午", "寅未", "卯申", "辰亥", "巳戌"], 노트: "배제" },
  해: { list: ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"], 노트: "의미 부여 불필요" },
  파: { list: ["子酉", "午卯", "寅亥", "巳申", "辰丑", "戌未"], 노트: "의미 부여 불필요" },
};
const SAL12 = ["지살", "년살", "월살", "망신", "장성", "반안", "역마", "육해", "화개", "겁살", "재살", "천살"];

export function extraTags(p: Pillars): Tag[] {
  const cols = p.map((g, i) => (g ? { g, i } : null)).filter(Boolean) as { g: string; i: number }[];
  const day = p[2][0]; const out: Tag[] = []; const add = (태그: string, 대상: string, 노트입장: string, 인접: Tag["인접"] = null) => out.push({ 태그, 대상, 인접, 노트입장 });
  for (const { g, i } of cols) {
    if (NOBLE[day].includes(g[1])) add("천을귀인", `${POS_NAME[i]}지 ${g[1]}`, "배제");
    if (BAEKHO.includes(g)) add("백호", `${POS_NAME[i]}주 ${g}`, "배제");
    if (GOEGANG.includes(g)) add("괴강", `${POS_NAME[i]}주 ${g}`, "배제");
  }
  for (const [base, nm] of [[p[0][1], "연지"], [p[2][1], "일지"]] as const) {
    const grp = SAMHAP_OF(base);
    for (const [table, t, note] of [[DOHWA, "도화", "왕지의 신살 관점으로만 언급"], [YEOKMA, "역마", "생지의 신살 관점으로만 언급"], [HWAGAE, "화개", "고지의 신살 관점으로만 언급"]] as const)
      for (const { g, i } of cols) if (g[1] === table[grp]) add(`${t}(${nm} 기준)`, `${POS_NAME[i]}지 ${g[1]}`, note);
  }
  const start = BRANCHES.indexOf(SAMHAP_OF(p[0][1])[0]);
  for (const { g, i } of cols) add(`12신살 ${SAL12[(BRANCHES.indexOf(g[1]) - start + 12) % 12]}`, `${POS_NAME[i]}지 ${g[1]}`, "배제");
  const idx = G60.indexOf(p[2]); const xun = idx - (idx % 10); const gm = BRANCHES[(xun + 10) % 12] + BRANCHES[(xun + 11) % 12];
  for (const { g, i } of cols) if (gm.includes(g[1])) add("공망", `${POS_NAME[i]}지 ${g[1]}`, "배제");
  for (const [t, { list, 노트 }] of Object.entries(PAIRS))
    for (let a = 0; a < cols.length; a++) for (let c = a + 1; c < cols.length; c++) {
      const pair = list.find((q) => q.includes(cols[a].g[1]) && q.includes(cols[c].g[1]) && cols[a].g[1] !== cols[c].g[1]);
      if (pair) add(t, pair, 노트, cols[c].i - cols[a].i === 1 ? "인접" : "떨어짐");
    }
  const brs = cols.map((c) => c.g[1]);
  for (const grp of ["寅巳申", "丑戌未"]) {
    const got = [...new Set(brs.filter((b) => grp.includes(b)))].sort((a, b) => grp.indexOf(a) - grp.indexOf(b));
    if (got.length >= 2) add(got.length === 3 ? "삼형 완성" : "형(일부)", got.join(""), grp === "寅巳申" ? "인사신만 인정" : "의미 부여 불필요");
  }
  if (brs.includes("子") && brs.includes("卯")) add("형", "子卯", "의미 부여 불필요");
  for (const b of "辰午酉亥") if (brs.filter((x) => x === b).length >= 2) add("자형", b + b, "의미 부여 불필요");
  if (brs.some((b) => "戌亥".includes(b)) && brs.filter((b) => "戌亥辰巳".includes(b)).length >= 2) add("천라지망", brs.filter((b) => "戌亥辰巳".includes(b)).join(""), "배제");
  return out;
}

// ---------- 조후 ----------
export type Johu = { 점수: number; 온도: "조열 뚜렷" | "조열 경향" | "무난" | "한습 경향" | "한습 뚜렷"; 습조: "습" | "조" | null; 필요오행: Element | null; 용신과: "조후 일치" | "조후 상충" | null;
  극단: boolean; 조후용신: Element | null; 활력: string | null; 계산: string[] };
// J-04 [합의·조건부 2026-10-07 카드 005]: 극단으로 뜨겁거나 차면 억부 용신보다 조후용신을 먼저 찾는다. 극단 기준 |점수| ≥ 6 [가설]
// — 운 판정(Y-09)은 아직 억부 용신 그대로. 조후용신을 운에 어떻게 반영할지는 충돌 카드 009가 정함
const JOHU_EXTREME = 6;
// J-04 역할: 조후는 "활력·기분의 기복" 보조 태그(정신 건강·질병·성격 판정에 쓰지 않음). 에너지 섹션의 재료
const VITALITY: Partial<Record<Johu["온도"], string>> = { "조열 뚜렷": "열이 쌓이는 쪽 — 밖으로 내보내는(발산) 일이 먼저", "조열 경향": "열이 쌓이기 쉬운 쪽", "한습 경향": "가라앉기 쉬운 쪽", "한습 뚜렷": "가라앉는 쪽 — 몸을 데우고 움직이는 일이 먼저" };

export function johu(p: Pillars, y: Yongsin): Johu {
  const 계산: string[] = []; let s = 0; const plus = (n: number, why: string) => { if (n) { s += n; 계산.push(`${why} ${n > 0 ? "+" : ""}${n}`); } };
  const mb = p[1][1]; plus("巳午未".includes(mb) ? 3 : "寅卯辰".includes(mb) ? 1 : "申酉戌".includes(mb) ? -1 : -3, `${mb}월`);
  if (p[3]) plus("巳午未".includes(p[3][1]) ? 1 : "亥子丑".includes(p[3][1]) ? -1 : 0, `${p[3][1]}시`);
  const rest: string[] = []; p.forEach((g, i) => { if (!g) return; rest.push(g[0]); if (i === 0 || i === 2) rest.push(g[1]); });
  for (const ch of rest) { const el = STEM_EL[ch] ?? BRANCH_EL[ch]; plus(el === "화" ? 1 : el === "수" ? -1 : 0, ch); }
  const 온도 = s >= 4 ? "조열 뚜렷" : s >= 2 ? "조열 경향" : s >= -1 ? "무난" : s >= -3 ? "한습 경향" : "한습 뚜렷";
  const brs = p.flatMap((g) => (g ? [g[1]] : [])); const wet = brs.filter((b) => "辰丑".includes(b)).length, dry = brs.filter((b) => "戌未".includes(b)).length;
  const 습조 = wet - dry >= 2 ? "습" : dry - wet >= 2 ? "조" : null;
  const 필요오행: Element | null = 온도.startsWith("한습") ? "화" : 온도.startsWith("조열") ? "수" : null;
  const r: Role | null = 필요오행 ? y.오행역할[필요오행] : null;
  const 극단 = Math.abs(s) >= JOHU_EXTREME;
  return { 점수: s, 온도, 습조, 필요오행, 용신과: !r ? null : "용희".includes(r) ? "조후 일치" : "기구".includes(r) ? "조후 상충" : null,
    극단, 조후용신: 극단 ? 필요오행 : null, 활력: VITALITY[온도] ?? null, 계산 };
}
