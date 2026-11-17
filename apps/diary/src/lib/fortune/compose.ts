// v5 (2026-11-14) — 단락 사전에서 오늘의 글감을 고른다. 설계: 사주 일기/피드백/오늘의운세_v5_설계_2026-11-10.md
//   글의 몸은 앱 주인이 확정한 단락(dict.ts)이고, 모델은 그 단락을 한 편으로 엮는 편집자다. 이 파일은 "어느 단락을"만 정한다.
//   축 = 일진 두 글자 × 내 일간 → 십신 둘 × 내 사주에서의 역할(용·희·한·구·기).
// 고르는 규칙은 앱 주인이 원장의 물음에 답한 것 그대로다(피드백/지적_원장.md "주인 확정 현황"):
//   - 같은 그룹의 두 십신이 함께 오면(혼잡) 편 쪽(겁재·편재·편인·상관·편관)을 중심으로 (물음 3)
//   - 운에서 오는 지지는 원국 네 지지와 다 관계를 맺되 영향은 일지 > 월지·시지 >>>> 연지 (물음 1) — 연지는 하루 글에 쓰지 않는다
//   - 2026-11-15: "비겁 많은 날의 재성 → 조심 단락"은 뺐다. 그 조건이 지지 군겁쟁재 표시(코어 Y-15, [가설])였는데 앱 주인 답(물음 13)은
//     "군겁쟁재는 같은 음양의 천간끼리, 지지는 충·극으로 설명"이다. 천간 기준은 판정 규칙 3을 고칠 때 점수와 함께 다시 본다
//   - 한신은 좋은 쪽을 중심으로 쓰고 부담을 곁들인다. 강한 사주의 관성은 좋게 보되 고통이 따른다는 설명을 붙인다 (물음 4)
//   - 복음은 같은 글자가 왔다는 사실만, 합으로 오행이 바뀐다는 말은 쓰지 않는다 (물음 6, 의견 13)
import type { TenGod } from "@saju/engine";
import { DICT_ACTIONS, DICT_CLOSINGS, DICT_END, DICT_PAIRS, DICT_POS, DICT_REL, DICT_SCENES, DICT_TEN_GOD, DICT_TITLES, DICT_VERSION, GROUP_ORDER, type DictBand, type DictPos, type DictPosKind } from "./dict";
import { daySeed, readOf, type PartRead } from "./plan";
import type { CoreFortune, CoreLuckPart, CoreRelationHit, RoleLabel, TenGodFamily } from "./types";

/** use = 잘 쓸 때 · strong = 세질 때 · both = 좋은 쪽을 중심으로 쓰되 부담을 곁들임(한신·시간 모름) */
export type V5Face = "use" | "strong" | "both";
export interface V5Part {
  자리: "천간" | "지지";
  tenGod: TenGod;
  family: TenGodFamily;
  read: PartRead;
  /** 내 사주에서의 역할(용·희·한·구·기). 시간 모름이면 null — 인장 개수를 정한다(seals.ts) */
  label: RoleLabel;
  face: V5Face;
  /** 글의 몸이 되는 단락 (both면 잘 쓸 때 단락) */
  글: string;
  /** both일 때만: 세질 때 단락 — 한두 문장으로 곁들인다 */
  부담?: string;
  장면: string[];
}
export interface V5Position { kind: DictPosKind; pos: DictPos; 글: string }
export interface V5Material {
  dict: string;
  band: DictBand;
  core: V5Part;
  /** 다른 쪽 글자의 십신. 같은 십신이 두 번 온 날은 null */
  other: V5Part | null;
  /** 같은 십신이 천간·지지에 겹쳐 온 날 */
  겹침: boolean;
  /** 두 기운의 그룹 사이 단락 */
  연결: string;
  /** 편·정을 나눈 연결문 (의견 3의 일곱 쌍에 해당할 때만) */
  연결문: { 뜻: string; 예: string } | null;
  자리: V5Position | null;
  마무리: string;
  끝인사: string[];
  제목보기: string[];
  하면피해요: { do: string; dont: string }[];
  비유: { 말: string; 뜻: string } | null;
  /** 이 십신을 글로 옮길 때 넘지 말 선 (편인·정인) */
  넘지말선: string[];
  /** 2026-11-17 기록 반영: 둘째 문단에 한 문장으로 녹일 기록 사실. 없으면 null */
  내기록?: string | null;
}

/** 혼잡일 때 중심이 되는 쪽 (물음 3) */
export const PIAN: ReadonlySet<TenGod> = new Set<TenGod>(["겁재", "편재", "편인", "상관", "편관"]);
/** 운의 지지가 닿는 자리의 무게 (물음 1). 연지는 0 — 하루 글에 쓰지 않는다 */
export const POS_WEIGHT: Record<DictPos, number> = { 일: 3, 월: 2, 시: 2, 연: 0 };
const KIND_WEIGHT: Record<DictPosKind, number> = { 충: 3, 합: 2, 복음: 1.5 };

export const faceOf = (read: PartRead): V5Face => (read === "활용" ? "use" : read === "과함" ? "strong" : "both");
export const relKey = (a: TenGodFamily, b: TenGodFamily): string => {
  const [x, y] = GROUP_ORDER.indexOf(a) <= GROUP_ORDER.indexOf(b) ? [a, b] : [b, a];
  return `${x}+${y}`;
};
const rotate = <T,>(xs: readonly T[], n: number, k: number): T[] => { const s = xs.length ? ((k % xs.length) + xs.length) % xs.length : 0; return [...xs.slice(s), ...xs.slice(0, s)].slice(0, n); };

/** 중심이 천간인가: |점수| 큰 쪽(같으면 천간). 같은 그룹의 다른 십신이 함께 오면 편 쪽 */
export function coreIsStemV5(stem: CoreLuckPart, branch: CoreLuckPart): boolean {
  if (stem.family === branch.family && stem.tenGod !== branch.tenGod) return PIAN.has(stem.tenGod);
  return Math.abs(stem.score) >= Math.abs(branch.score);
}

/** 닿는 자리 하나: 자리 무게 × 관계 무게가 큰 것(일지 > 월지·시지, 충 > 합 > 복음), 같으면 충 먼저. 연지와 약한 반합은 쓰지 않는다.
 *  시지 충(2×3)이 일지 복음(3×1.5)보다 앞선다 — 복음은 "같은 글자가 왔다는 사실만" 말하는 약한 신호라서(물음 6) */
export function pickPosition(hits: readonly CoreRelationHit[]): V5Position | null {
  const w = (x: { kind: DictPosKind; pos: DictPos }) => POS_WEIGHT[x.pos] * KIND_WEIGHT[x.kind];
  const cands = hits
    .filter((h) => POS_WEIGHT[h.pos] > 0 && !(h.kind === "반합" && h.strength < 1))
    .map((h) => ({ kind: (h.kind === "충" ? "충" : h.kind === "복음" ? "복음" : "합") as DictPosKind, pos: h.pos as DictPos }))
    .sort((a, b) => w(b) - w(a) || KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind] || POS_WEIGHT[b.pos] - POS_WEIGHT[a.pos]);
  const top = cands[0];
  return top ? { ...top, 글: DICT_POS[top.kind][top.pos] } : null;
}

export interface ComposeInput {
  core: CoreFortune;
  band: DictBand;
  date: string;
  /** 최근 글의 마지막 문장들 — 같은 끝인사를 다시 고르지 않는다 */
  recentEndings?: readonly string[];
  /** 2026-11-17 기록 반영: 코드가 고른 기록 한 줄(recall.ts recordLineOf) */
  recordLine?: string | null;
}

export function composeV5(input: ComposeInput): V5Material {
  const { core, band } = input;
  const seed = daySeed(input.date);
  const { stem, branch, method } = core.dayLuck;
  const stemFirst = coreIsStemV5(stem, branch);
  const partOf = (p: CoreLuckPart, 자리: "천간" | "지지", k: number, n: number): V5Part => {
    const read = readOf(p.label, method);
    const face = faceOf(read);
    const d = DICT_TEN_GOD[p.tenGod];
    return { 자리, tenGod: p.tenGod, family: p.family, read, label: p.label, face, 글: face === "strong" ? d.strong : d.use, ...(face === "both" ? { 부담: d.strong } : {}), 장면: rotate(DICT_SCENES[p.tenGod].장면, n, k) };
  };
  const [c, o] = stemFirst ? [stem, branch] : [branch, stem];
  const 겹침 = c.tenGod === o.tenGod;
  const corePart = partOf(c, stemFirst ? "천간" : "지지", seed, 3);
  const other = 겹침 ? null : partOf(o, stemFirst ? "지지" : "천간", seed + 1, 2);

  const 연결 = DICT_REL[relKey(c.family, o.family)]!;
  const 연결문 = 겹침 ? null : DICT_PAIRS[`${c.tenGod}+${o.tenGod}`] ?? DICT_PAIRS[`${o.tenGod}+${c.tenGod}`] ?? null;

  const used = (input.recentEndings ?? []).join(" ");
  const fresh = DICT_CLOSINGS[band].filter((x) => !used.includes(x.slice(0, 12)));
  const 끝인사 = rotate(fresh.length >= 2 ? fresh : DICT_CLOSINGS[band], 2, seed);

  const titleOf = (p: V5Part): string[] => (p.face === "both" ? [DICT_TITLES[p.tenGod].use, DICT_TITLES[p.tenGod].strong] : [DICT_TITLES[p.tenGod][p.face]]);
  const sc = DICT_SCENES[corePart.tenGod];
  return {
    dict: DICT_VERSION,
    band,
    core: corePart,
    other,
    겹침,
    연결,
    연결문,
    자리: pickPosition(core.relations.hits),
    마무리: DICT_END[band],
    끝인사,
    제목보기: titleOf(corePart),
    내기록: input.recordLine ?? null,
    하면피해요: [DICT_ACTIONS[corePart.tenGod][seed % 2]!, ...(other ? [DICT_ACTIONS[other.tenGod][(seed + 1) % 2]!] : [])],
    비유: sc.비유.length ? sc.비유[seed % sc.비유.length]! : null,
    넘지말선: [corePart, other].flatMap((p) => (p && DICT_SCENES[p.tenGod].주의 ? [DICT_SCENES[p.tenGod].주의!] : [])),
  };
}

const sentences = (s: string): string[] => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);

/** 모델 없이 사전 단락만으로 엮은 글 — v5의 폴백. 문장은 사전 그대로다(순서만 정한다) */
export function v5Fallback(m: V5Material): { headline: string; first: string[]; second: string[]; do: string; dont: string } {
  const first = sentences(m.core.글).slice(0, 5);
  const second: string[] = [];
  if (m.other) second.push(...sentences(m.other.글).slice(0, 2));
  else second.push(...sentences(m.연결).slice(0, 2));
  if (m.core.부담) second.push(sentences(m.core.부담).at(-1)!);
  if (m.자리) second.push(...sentences(m.자리.글).slice(0, 1));
  second.push(m.끝인사[0] ?? sentences(m.마무리).at(-1)!);
  while (first.length + second.length > 10 && second.length > 2) second.splice(second.length - 2, 1);   // 끝인사는 남기고 그 앞 문장부터 던다
  const a = m.하면피해요[0]!;
  return { headline: m.제목보기[0]!, first, second, do: a.do, dont: a.dont };
}
