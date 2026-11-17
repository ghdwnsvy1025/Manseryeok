// v5 단락 사전 변환기 — 앱 주인이 운세 지적 원장(웹앱 "사전" 화면)에서 확정한 단락을 src/lib/fortune/dict.ts로 옮긴다.
// 원장 저장소는 세션(ArtifactData)만 읽을 수 있어서, 먼저 dict 모음을 한 파일로 떠 둔다(피드백/운세개편/v5_단락사전_확정_<날짜>.json).
// 실행 (apps/diary):  node scripts/fortune-dict-build.mjs [확정본.json]
//   확정(edited)하지 않은 본문 칸이 하나라도 있거나, 재료 칸(의견 3·6·7·8·9)의 꼴이 달라 못 읽으면 멈춘다 — 빈 사전으로 글을 쓰지 않게.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] ?? path.resolve(ROOT, "../../../피드백/운세개편/v5_단락사전_확정_2026-11-15.json");
const OUT = path.join(ROOT, "src/lib/fortune/dict.ts");
const snap = JSON.parse(readFileSync(SRC, "utf8"));
const docs = Object.fromEntries(snap.docs.map((d) => [d.id, d]));
const fail = (m) => { throw new Error(`사전 변환 실패: ${m}`); };
const clean = (s) => String(s).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim();
const body = (id) => { const d = docs[id]; if (!d) fail(`${id} 없음`); if (!d.edited) fail(`${id} 확정 안 됨`); const t = clean(d.text); if (t.length < 20) fail(`${id} 본문이 너무 짧음`); return t; };

const TG = { bigyeon: "비견", geopjae: "겁재", siksin: "식신", sanggwan: "상관", pyeonjae: "편재", jeongjae: "정재", pyeongwan: "편관", jeonggwan: "정관", pyeonin: "편인", jeongin: "정인" };
const TEN = Object.values(TG);
const GR = { bg: "비겁", ss: "식상", js: "재성", gs: "관성", is: "인성" };
const POS = { yeon: "연", wol: "월", il: "일", si: "시" };
const KIND = { chung: "충", hap: "합", bogeum: "복음" };
const BAND = { good: "좋음", mid: "무난", care: "주의" };

// ---- 본문 50칸 ----
const tenGod = Object.fromEntries(Object.entries(TG).map(([rom, ko]) => [ko, { strong: body(`tg_${rom}_strong`), use: body(`tg_${rom}_use`) }]));
const rel = {};
const gk = Object.keys(GR);
for (let i = 0; i < gk.length; i++) for (let j = i; j < gk.length; j++) rel[`${GR[gk[i]]}+${GR[gk[j]]}`] = body(`rel_${gk[i]}_${gk[j]}`);
const pos = Object.fromEntries(Object.entries(KIND).map(([k, ko]) => [ko, Object.fromEntries(Object.entries(POS).map(([p, pk]) => [pk, body(`pos_${k}_${p}`)]))]));
const end = Object.fromEntries(Object.entries(BAND).map(([k, ko]) => [ko, body(`end_${k}`)]));

// ---- 재료 (의견 칸 — 앱 주인이 "GPT 의견대로" 받아들인 것만) ----
const op = (id) => { const d = docs[id]; if (!d || !d.edited) fail(`${id} 확정 안 됨`); return String(d.gpt).replace(/\r/g, ""); };
const unq = (s) => s.replace(/^[‘'"“]|[’'"”]$/g, "").trim();

// 의견 6: 제목 보기 — "비견 / 지나칠 때: …"
const titles = Object.fromEntries(TEN.map((t) => [t, {}]));
for (const m of op("op_06").matchAll(/^(\S+) \/ (지나칠 때|잘 쓸 때): (.+)$/gm)) if (titles[m[1]]) titles[m[1]][m[2] === "잘 쓸 때" ? "use" : "strong"] = m[3].trim();
for (const t of TEN) if (!titles[t].use || !titles[t].strong) fail(`의견 6: ${t} 제목 보기를 못 읽음`);

// 의견 7: 하면 좋아요·피해요 — "비견 A: 하면 좋아요 — … / 피해요 — …"
const actions = Object.fromEntries(TEN.map((t) => [t, []]));
for (const m of op("op_07").matchAll(/^(\S+) [AB]: 하면 좋아요 — (.+?) \/ 피해요 — (.+)$/gm)) if (actions[m[1]]) actions[m[1]].push({ do: m[2].trim(), dont: m[3].trim() });
for (const t of TEN) if (actions[t].length !== 2) fail(`의견 7: ${t} 하면·피해요가 ${actions[t].length}개`);

// 의견 8: 끝인사 — "좋음에 어울리는 말 10개" 아래 번호 줄
const closings = { 좋음: [], 무난: [], 주의: [] };
{ let cur = null; for (const l of op("op_08").split("\n")) { const h = l.match(/^(좋음|무난|주의)에 어울리는 말/); if (h) { cur = h[1]; continue; } const m = l.match(/^\d+\.\s+(.+)$/); if (cur && m) closings[cur].push(m[1].trim()); else if (l.trim() && !/^\d/.test(l) && cur && closings[cur].length >= 10) cur = null; } }
for (const b of Object.keys(closings)) if (closings[b].length !== 10) fail(`의견 8: ${b} 끝인사가 ${closings[b].length}개`);

// 의견 9: 생활 장면·비유 — 십신 이름 한 줄 아래 "생활 장면 N. …", "비유: ‘…’. 설명"
const scenes = Object.fromEntries(TEN.map((t) => [t, { 장면: [], 비유: [] }]));
{ let cur = null; for (const l of op("op_09").split("\n")) { const t = l.trim(); const head = t.match(/^(\S+)(?: — .*)?$/); if (head && TEN.includes(head[1])) { cur = head[1]; continue; } if (!cur) continue; const w = t.match(/^주의:\s*(.+)$/); if (w) { scenes[cur].주의 = w[1].trim(); continue; } const s = t.match(/^생활 장면 \d+\.\s+(.+)$/); if (s) { scenes[cur].장면.push(s[1].trim()); continue; } const f = t.match(/^(?:또 다른 )?비유:\s*[‘'](.+?)[’']\.?\s*(.*)$/); if (f) scenes[cur].비유.push({ 말: f[1].trim(), 뜻: f[2].trim() }); } }
for (const t of TEN) if (scenes[t].장면.length < 4 || !scenes[t].비유.length) fail(`의견 9: ${t} 장면 ${scenes[t].장면.length}개·비유 ${scenes[t].비유.length}개`);

// 의견 3: 편·정을 나눈 연결문 — "1) 비견 + 식신: 뜻. 예: ‘…’"
const pairs = {};
for (const m of op("op_03").matchAll(/^\d+\)\s+(\S+) \+ (\S+):\s+(.+?)\s+예:\s*[‘'](.+?)[’']\s*$/gm)) if (TEN.includes(m[1]) && TEN.includes(m[2])) pairs[`${m[1]}+${m[2]}`] = { 뜻: m[3].trim(), 예: unq(m[4]) };
if (Object.keys(pairs).length !== 7) fail(`의견 3: 연결문이 ${Object.keys(pairs).length}개`);

// 2026-11-15: 원장의 "제목" 칸(title_<로마자>_<strong|use>)을 앱 주인이 고르면 그 제목이 제목 보기가 된다(칸마다, 안 고른 칸은 의견 6 그대로)
const TG_ROM = Object.fromEntries(Object.entries(TG).map(([rom, ko]) => [ko, rom]));
let picked = 0;
for (const t of TEN) for (const face of ["strong", "use"]) {
  const d = docs[`title_${TG_ROM[t]}_${face}`];
  if (d?.edited && clean(d.text)) { titles[t][face] = clean(d.text); picked++; }
}
// 원장의 "인장" 칸(seal_<로마자>_<good|care>, 글 "낱말, 낱말")이 스무 칸 다 확정되면 인장 낱말이 된다. 하나라도 덜 되면 null(seals.ts 초안을 쓴다)
let seals = {};
for (const t of TEN) for (const tone of ["good", "care"]) {
  const d = docs[`seal_${TG_ROM[t]}_${tone}`];
  const w = d?.edited ? clean(d.text).split(/\s*[,，·]\s*/).filter(Boolean) : [];
  if (w.length !== 2) { seals = null; break; }
  (seals[t] ||= {})[tone] = w;
}
if (seals && Object.keys(seals).length !== TEN.length) seals = null;

// 사전 판본 = 가장 늦게 확정된 칸의 날짜 (칸 하나라도 고치면 판본이 바뀐다)
/** 한국 시각 "2026-11-15T0222" (확정 시각이 바뀌면 사전 판본도 바뀐다) */
const kstStamp = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? String(iso).slice(0, 10) : new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace(":", ""); };
const stamp = snap.docs.map((d) => d.updatedAt).filter(Boolean).sort().at(-1) ?? snap.savedAt;
const j = (v) => JSON.stringify(v, null, 2);
const ts = `// 이 파일은 scripts/fortune-dict-build.mjs가 만든다 — 손으로 고치지 않는다.
// v5 단락 사전: 앱 주인이 운세 지적 원장(웹앱 "사전" 화면)에서 확정한 글. 글의 몸은 이 단락이고 AI는 편집자다.
// 원본: ${path.basename(SRC)} (${snap.savedAt}). 고치려면 원장에서 고친 뒤 확정본을 다시 떠서 변환기를 돌린다.
import type { TenGod } from "@saju/engine";
import type { TenGodFamily } from "./types";

/** 사전 판본 — 캐시 지문과 기록에 남긴다 */
export const DICT_VERSION = ${j(`dict-${kstStamp(stamp)}`)};

export type DictFace = "strong" | "use";
export type DictPos = "연" | "월" | "일" | "시";
export type DictPosKind = "충" | "합" | "복음";
export type DictBand = "좋음" | "무난" | "주의";

/** 십신 10 × 두 면 — strong = 세질 때(지나칠 때), use = 잘 쓸 때 */
export const DICT_TEN_GOD: Record<TenGod, Record<DictFace, string>> = ${j(tenGod)};

/** 오늘 두 기운의 그룹 사이 (15쌍). 열쇠는 "비겁+식상" — 순서는 비겁·식상·재성·관성·인성 */
export const DICT_REL: Record<string, string> = ${j(rel)};
export const GROUP_ORDER: readonly TenGodFamily[] = ["비겁", "식상", "재성", "관성", "인성"];

/** 오늘 지지가 내 원국 지지와 닿는 자리 (충·합·복음 × 연·월·일·시) */
export const DICT_POS: Record<DictPosKind, Record<DictPos, string>> = ${j(pos)};

/** 단계별 마무리 */
export const DICT_END: Record<DictBand, string> = ${j(end)};

// ---- 재료: 앱 주인이 받아들인 GPT 의견 3·6·7·8·9 (2026-11-14) ----

/** 제목 보기 (의견 6). 그대로 붙이지 않고 그날 조합에 맞게 다시 쓴다 */
export const DICT_TITLES: Record<TenGod, Record<DictFace, string>> = ${j(titles)};

/** 하면 좋아요·피해요 보기 (의견 7) — 십신마다 두 벌 */
export const DICT_ACTIONS: Record<TenGod, { do: string; dont: string }[]> = ${j(actions)};

/** 끝인사 (의견 8) — 단계마다 열 개 */
export const DICT_CLOSINGS: Record<DictBand, string[]> = ${j(closings)};

/** 생활 장면과 비유 (의견 9) */
export const DICT_SCENES: Record<TenGod, { 장면: string[]; 비유: { 말: string; 뜻: string }[]; /** 이 십신을 글로 옮길 때 넘지 말 선 */ 주의?: string }> = ${j(scenes)};

/** 편·정을 나눈 연결문 (의견 3). 열쇠는 "비견+식신" */
export const DICT_PAIRS: Record<string, { 뜻: string; 예: string }> = ${j(pairs)};

/** 인장 낱말 (원장 "인장" 칸 스무 칸이 다 확정됐을 때만). null이면 seals.ts의 초안을 쓴다 */
export const DICT_SEALS: Record<TenGod, { good: [string, string]; care: [string, string] }> | null = ${j(seals)};
`;
writeFileSync(OUT, ts, "utf8");
console.log(`dict.ts 씀 — 십신 ${Object.keys(tenGod).length * 2} · 관계 ${Object.keys(rel).length} · 자리 ${Object.values(pos).reduce((n, o) => n + Object.keys(o).length, 0)} · 마무리 ${Object.keys(end).length} · 제목 ${TEN.length * 2} · 하면/피해요 ${TEN.length * 2} · 끝인사 30 · 장면 ${TEN.reduce((n, t) => n + scenes[t].장면.length, 0)} · 비유 ${TEN.reduce((n, t) => n + scenes[t].비유.length, 0)} · 연결문 ${Object.keys(pairs).length} · 주인이 고른 제목 ${picked}/20 · 인장 ${seals ? "확정본" : "초안(seals.ts)"}`);
