// 원본: 사주 코어 core/src/keywords.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/키워드.md KW-01~KW-05 — 판정값에 맞는 "칸"을 고릅니다. 칸 안에서 어느 낱말을 쓸지는 컨텐츠 층이 정합니다(상한만 줌).
// 원본 데이터는 규칙/키워드.json 하나뿐입니다 (복사본을 두지 않음).
import { type Group, type Pillars, type Role, type TenGod, STEM_EL, BRANCH_EL } from "./base";
import type { Balance, Yongsin, Luck } from "./yongsin";
import type { TzoneItem } from "./structure";

import KWJSON from "./data/키워드";            // [이식] 규칙/키워드.json → data/키워드.ts 상수 (import attributes 미사용)   // 파일을 직접 읽지 않고 import — 서버(Vercel)용으로 묶을 때 함께 들어가게
const KW: any = KWJSON;
export type Pick = { 칸: string; 낱말: string[]; 상한: number };
const pick = (table: string, key: string, col: string, 상한: number): Pick => ({ 칸: `${key}.${col}`, 낱말: KW[table][key][col], 상한 });

/** KW-01 일간 */
export function dayStemKeywords(p: Pillars): { 힘: string; 고르기: Pick[]; 짝과의차이: string } {
  const d = p[2][0]; const same = STEM_EL[d] === BRANCH_EL[p[2][1]]; const n = same ? 1 : 0;
  return { 힘: KW.천간[d].힘, 고르기: [pick("천간", d, "핵심", 3), pick("천간", d, "강점", 3 + n), pick("천간", d, "주의", 2 + n)], 짝과의차이: KW.천간[d].짝과의차이 };
}

/** KW-02 (가) 글자별 */
export function tenGodKeywords(god: TenGod, group: Group, b: Balance, y: Yongsin | null, withWork: boolean): { 순서: string; 고르기: Pick[]; 일의성격: string | null } {
  const role: Role | null = y ? y.역할[group] : null; const work = withWork ? KW.십신[god].일의성격 : null;
  if ((group === b.중심기운 || group === b.혼합) && !(role && "용희".includes(role))) return { 순서: "1 중심기운", 고르기: [pick("십신", god, "많을때", 3), pick("십신", god, "강점", 1)], 일의성격: work };
  if (!role) return { 순서: "역할 미정(시간 모름) → 양면", 고르기: [pick("십신", god, "강점", 2), pick("십신", god, "주의", 2)], 일의성격: work };
  if ("용희".includes(role)) return { 순서: `2 ${role}`, 고르기: [pick("십신", god, "강점", 3), pick("십신", god, "주의", 1)], 일의성격: work };
  if (role === "기") return { 순서: "3 기", 고르기: [pick("십신", god, "주의", 3), pick("십신", god, "강점", 1)], 일의성격: work };
  return { 순서: `4 ${role}`, 고르기: [pick("십신", god, "강점", 1), pick("십신", god, "주의", 1)], 일의성격: work };
}
export const tzoneKeywords = (items: TzoneItem[], b: Balance, y: Yongsin | null) =>
  items.map((t) => ({ 자리: t.자리, 십신: t.십신, 쓰기어려움: t.극당함, ...tenGodKeywords(t.십신, t.그룹, b, y, t.자리 !== "일지") }));

/** KW-02 (나) 그룹별 — 한 번만 */
export function groupKeywords(b: Balance, usable: Record<Group, boolean>) {
  const centers = [b.중심기운, ...(b.혼합 ? [b.혼합] : [])];
  const 중심 = centers.map((c) => {
    const bal: Group = KW.십신그룹[c].균형추; const amt = b.양[bal];
    const 균형추상태 = amt === "없음" ? "없음" : amt === "약함" || !usable[bal] ? "약함" : "있음";
    return { 그룹: c, 물통: KW.십신그룹[c].물통, 과다: pick("십신그룹", c, "과다", 3), 균형추: bal, 균형추상태,
      균형추낱말: 균형추상태 === "있음" ? pick("십신그룹", c, "균형추있음", 2) : 균형추상태 === "없음" ? pick("십신그룹", c, "균형추없음", 2) : null };
  });
  const 없음 = (Object.keys(b.양) as Group[]).filter((g) => b.양[g] === "없음").map((g) => ({ 그룹: g, 오행: b.그룹오행[g], 부족: pick("십신그룹", g, "부족", 2), 오행없음: pick("오행", b.그룹오행[g], "없음", 1), 금지: "없어서 갈망한다는 서술 금지" }));
  return { 중심, 없음 };
}

/** KW-03 운 */
export function luckKeywords(l: Luck): { 글자: string; 십신: string; 라벨: Role; 고르기: Pick[] }[] {
  return [l.천간, l.지지].map((x) => {
    const g = x.십신; const r = x.라벨;
    const 고르기 = "용희".includes(r) ? [pick("십신", g, "운_긍정", 2)] : "기구".includes(r) ? [pick("십신", g, "운_부정", 2)] : [pick("십신", g, "운_긍정", 1), pick("십신", g, "운_부정", 1)];
    return { 글자: x.글자, 십신: g, 라벨: r, 고르기 };
  });
}

/** KW-04 영역에서 쓰는 칸 */
export const areaKeywords = (dayStem: string, gods: TenGod[]) => ({
  일의방향: pick("천간", dayStem, "일의방향", 2), 관계방식: pick("천간", dayStem, "관계방식", 2),
  재물: gods.filter((g) => g === "정재" || g === "편재").map((g) => pick("십신", g, "재물", 2)),
});
export const RULES = { 섹션당최대: 6, 같은낱말최대: 2, 근거태그: "문단 끝에 쓴 칸 이름을 남김 (예: 편관.강점)" };
