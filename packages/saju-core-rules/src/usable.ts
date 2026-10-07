// 원본: 사주 코어 core/src/usable.ts @ 240c91dbe54a60059d42b74148db88a31aebd16d (2026-10-07 복사, 이전 ebf972d). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 규칙/용신.md Y-12 쓰는 기운(억부 보조) · 규칙/구조.md K-09 T존 조합
// 2026-10-07 이론 확답 루프 카드 001·002·003·006 [합의] — 사용자 확답 원문은 규칙/가설대장.md
//
// 생각: 현묘표의 "공식 용신"(하나, 운 판정용)은 그대로 두고, 그 옆에 "쓰는 기운"을 따로 낸다.
//   - 비겁이 중심인 신강 사주에서는 원국에 실제로 있는 식상·재성·관성이 전부 쓸 수 있는 기운이다(둘이면 둘 다). 서로 충돌해도 없는 것보단 낫다.
//   - 인성이 중심이면 관성이 있어도 재성이 훨씬 중요하고(운에서 재성을 기다리는 형국), 인성 옆에 식상이 붙으면 길이 줄고 흉이 는다(도식).
//   - 비겁·인성이 함께 많으면 비율대로 나눠 가진다.
//   - 세기: T존(월간·시간·일지)이 가장 좋고, 시주는 일주와만 맞닿아 깨끗하게 쓸 수 있어 더 좋다. 중심 글자(비겁·인성) 바로 옆에 붙어 있으면 더 좋다.
//     지지에만 비겁이 깔려 있으면 지지의 관성이 더 좋을 수 있다(같은 층에서 맞닿음으로 잡음). 천간 투출은 격국의 관점이라 여기서는 세지 않는다.
//   - 중화면 쓰는 기운보다 T존 해석이 더 중요하다.
//   - 신약은 거울상: 원국에 있는 비겁·인성이 쓰는 기운(카드 006).
//   - 플래그는 길흉이 함께 드러난다는 뜻이지 빼라는 뜻이 아니다(군겁쟁재, 식상-관성 맞닿음, 도식).
// 숫자(가중·점수)는 전부 [가설] — 사람이 확답할 수 없는 값이라 서비스 응답으로만 고친다.
import { type Pillars, type Group, type Element, type Node, nodesOf, adjacent, isDayStem, nodeName, tenGod, mainStem, groupMap } from "./base";
import type { Balance } from "./yongsin";
import type { TzoneItem } from "./structure";

export type UsableItem = { 글자: string; 자리: string; 십신: string; 그룹: Group; 오행: Element; 세기: number; 근거: string[]; 플래그: string[] };
export type Usable = { 발동: boolean; 이유: string; 중화: boolean; 항목: UsableItem[]; 메모: string[] };

const inTzone = (n: Node) => (n.kind === "간" && (n.pos === 1 || n.pos === 3)) || (n.kind === "지" && n.pos === 2);

/** Y-12 쓰는 기운 */
export function usable(p: Pillars, b: Balance): Usable {
  const day = p[2][0]; const { toGroup } = groupMap(day);
  const N = nodesOf(p); const grp = (n: Node) => toGroup[n.el];
  const center = b.중심기운; const mixed = !!b.혼합 && b.묶음이름 === "인비";
  const strong = b.신강약 === "신강", mid = b.신강약 === "중화";
  if (!(strong || mid)) return weakUsable(p, b);

  // 후보 그룹과 가중 [가설]: 비겁 중심은 식·재·관 모두 1 / 인성 중심은 재성 1, 관성·식상 0.5 / 혼합은 비겁 비율만큼 섞음
  const weight: Partial<Record<Group, number>> = {};
  const bi = b.그룹퍼센트.비겁, ins = b.그룹퍼센트.인성;
  if (center === "인성" && !mixed) { weight.재성 = 1; weight.관성 = 0.5; weight.식상 = 0.5; }
  else if (mixed) { const w = bi / Math.max(1, bi + ins); weight.재성 = 1; weight.관성 = 0.5 + 0.5 * w; weight.식상 = 0.5 + 0.5 * w; }
  else { weight.재성 = 1; weight.관성 = 1; weight.식상 = 1; }

  const centerNodes = N.filter((n) => grp(n) === "비겁" || grp(n) === "인성");         // 눌러야 할 쪽(일간 포함)
  const biNodes = N.filter((n) => grp(n) === "비겁"), inNodes = N.filter((n) => grp(n) === "인성" && !isDayStem(n));
  const items: UsableItem[] = [];
  for (const n of N) {
    if (isDayStem(n)) continue; const g = grp(n); const w = weight[g]; if (!w) continue;
    const 근거: string[] = []; let s = 1;
    if (inTzone(n)) { s += 2; 근거.push("T존"); }
    if (n.pos === 3) { s += 1; 근거.push("시주"); }
    const touch = centerNodes.filter((m) => adjacent(n, m));
    if (touch.length) { s += 1; 근거.push(`${touch.map(nodeName).join("·")} 옆`); }
    const 플래그: string[] = [];
    if (g === "재성" && biNodes.filter((m) => adjacent(n, m)).length >= 2) 플래그.push("군겁쟁재 주의 — 비겁 둘 이상이 붙어 있음");
    if (g === "식상" && (center === "인성" || mixed) && inNodes.some((m) => adjacent(n, m))) 플래그.push("인성이 식상을 누름(도식) — 길은 줄고 흉이 늘 수 있음");
    const other: Group | null = g === "식상" ? "관성" : g === "관성" ? "식상" : null;
    if (other && N.some((m) => !isDayStem(m) && grp(m) === other && adjacent(n, m))) 플래그.push(`${other}과 맞닿음 — 길흉이 함께 드러남`);
    items.push({ 글자: n.ch, 자리: nodeName(n), 십신: tenGod(day, n.kind === "간" ? n.ch : mainStem(n.ch)).god, 그룹: g, 오행: n.el, 세기: Math.round(s * w * 10) / 10, 근거, 플래그 });
  }
  items.sort((a, c) => c.세기 - a.세기 || a.자리.localeCompare(c.자리, "ko"));
  const 메모: string[] = [];
  if (mid) 메모.push("중화 — 쓰는 기운보다 T존 해석이 더 중요");
  if (center === "인성" && !mixed) 메모.push("인성 중심 — 관성이 있어도 재성이 훨씬 중요, 운에서 재성을 기다리는 형국");
  if (!items.length) 메모.push("원국에 쓰는 기운 없음 — 운에서 기다림");
  return { 발동: true, 이유: `${b.신강약}(인비 ${b.인비}) · 중심 ${center}${b.혼합 ? `+${b.혼합} 혼합` : ""}`, 중화: mid, 항목: items, 메모 };
}

/** Y-12 신약 가지 [합의 2026-10-07 카드 006 "맞아"] — 신강의 식·재·관과 대칭으로, 원국에 있는 비겁·인성이 쓰는 기운.
 *  세기는 같은 식(기본 1 + T존 2 + 시주 1)이고 "옆"은 일간 옆(채워 줄 대상이 일간이라서). 가중은 둘 다 1 [가설]. */
function weakUsable(p: Pillars, b: Balance): Usable {
  const day = p[2][0]; const { toGroup } = groupMap(day);
  const N = nodesOf(p); const dayNode = N.find(isDayStem)!;
  const items: UsableItem[] = [];
  for (const n of N) {
    if (isDayStem(n)) continue; const g = toGroup[n.el]; if (g !== "비겁" && g !== "인성") continue;
    const 근거: string[] = []; let s = 1;
    if (inTzone(n)) { s += 2; 근거.push("T존"); }
    if (n.pos === 3) { s += 1; 근거.push("시주"); }
    if (adjacent(n, dayNode)) { s += 1; 근거.push("일간 옆"); }
    items.push({ 글자: n.ch, 자리: nodeName(n), 십신: tenGod(day, n.kind === "간" ? n.ch : mainStem(n.ch)).god, 그룹: g, 오행: n.el, 세기: s, 근거, 플래그: [] });
  }
  items.sort((a, c) => c.세기 - a.세기 || a.자리.localeCompare(c.자리, "ko"));
  const 메모: string[] = [];
  if (b.중심기운 === "비겁" || b.중심기운 === "인성") 메모.push(`신약인데 중심이 ${b.중심기운} — 식·재·관이 고르게 많아 사실상 중화에 가까움, 쓰는 기운보다 T존 해석이 더 중요`);
  if (!items.length) 메모.push("원국에 비겁·인성 없음 — 운에서 기다림");
  return { 발동: true, 이유: `신약(인비 ${b.인비}) · 중심 ${b.중심기운}${b.혼합 ? `+${b.혼합} 혼합` : ""} — 비겁·인성이 쓰는 기운`, 중화: false, 항목: items, 메모 };
}

export type TzoneCombo ={ 조합: Group[]; 태그: string; 양면?: string };
/** K-09 T존 조합 — 합의된 조합만 (카드 001) */
export function tzoneCombo(p: Pillars, T: TzoneItem[]): TzoneCombo[] {
  const inEl = groupMap(p[2][0]).toElement.인성;
  const sik = T.filter((t) => t.그룹 === "식상"), ins = T.filter((t) => t.그룹 === "인성");
  const out: TzoneCombo[] = [];
  if (sik.length && ins.length) {
    const pressed = sik.filter((t) => (t.극한글자 ?? []).some((s) => s.includes(`(${inEl},`)));   // 인성 글자가 그 식상을 바로 누름(도식)
    out.push({ 조합: ["식상", "인성"], 태그: "배운 것을 말이나 결과물로 꺼내는 재능이 있되, 꺼내기 전에 오래 고름",
      ...(pressed.length ? { 양면: `${pressed.map((t) => t.자리).join("·")}의 식상을 인성이 바로 누름 — 고르는 재능이 막힘으로 드러날 수 있음(길흉 함께)` } : {}) });
  }
  return out;
}
