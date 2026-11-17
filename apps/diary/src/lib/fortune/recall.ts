// 내 기록으로 본 오늘 — 지난 기록의 사실 (2026-11-15 앱 주인 "추천대로" 6번). 모델을 부르지 않고 코드가 기록만 센다.
// 기준은 앱 주인이 원장 물음 10에 답한 그대로다:
//   "한 번이면 그날의 사실만, 비슷한 기록이 적어도 두 번 이상 있을 때만 조심스럽게 반복 경향을 말한다. 자료가 없으면 넣지 않는다."
//   - same: 오늘과 같은 일진(60갑자)이던 날의 기록 — 행복도·기분·있었던 일. 한 번이어도 사실로 보여 준다(최근 둘까지).
//   - tendency: 오늘 온 성격 갈래(비겁·식상·재성·관성·인성)가 왔던 날, 그 갈래의 "있었던 일" 축에서 같은 단계를 두 번 이상 고른 경우만.
// 점수에는 반영하지 않는다(점수 보정은 지금의 행복도 ±0.8 그대로 — personal.ts).
import { STEMS_KO } from "@saju/engine";
import { canonicalMood, MOOD_PICK_LABEL, stateWords, type States } from "../entry";
import { dayGanji } from "../ganji";
import { stateByGroup, type StateEntry } from "../stats/states";
import type { TenGodFamily } from "./types";

export interface RecallEntry extends StateEntry {
  entry_date?: string;
  day_ganji_index: number;
  happiness: number;
  moods?: string[] | null;
  states?: States | null;
}
export interface FortuneRecall {
  /** 같은 일진이던 날 (최근 것부터, 둘까지) */
  same: { date: string; ganjiKo: string; happiness: number; moods: string[]; states: string[] }[];
  /** 같은 성격 갈래가 온 날의 경향 (두 번 이상 같은 단계일 때만) */
  tendency: { family: TenGodFamily; familyWord: string; axisLabel: string; word: string; count: number; n: number }[];
}

/** 화면에 쓰는 갈래 이름 — 사주 용어 대신 */
export const FAMILY_WORD: Record<TenGodFamily, string> = { 비겁: "내 쪽 기운(고집·경쟁)", 식상: "표현하는 기운", 재성: "돈·실속의 기운", 관성: "책임의 기운", 인성: "생각·배움의 기운" };
export const RECALL_MIN = 2;

export function recallOf(entries: readonly RecallEntry[], today: string, todayFamilies: readonly TenGodFamily[], dayMaster: string | null): FortuneRecall | null {
  if (!entries.length) return null;
  const t = dayGanji(today);
  const past = entries.filter((e) => !e.entry_date || e.entry_date < today);
  const same = past
    .filter((e) => e.day_ganji_index === t.index && e.entry_date)
    .sort((a, b) => (a.entry_date! < b.entry_date! ? 1 : -1))
    .slice(0, 2)
    .map((e) => ({
      date: e.entry_date!,
      ganjiKo: t.ko,
      happiness: e.happiness,
      moods: [...new Set((e.moods ?? []).map(canonicalMood))].map((m) => MOOD_PICK_LABEL[m] ?? m).slice(0, 3),
      states: stateWords(e.states ?? null).slice(0, 3),
    }));
  const tendency: FortuneRecall["tendency"] = [];
  if (dayMaster && STEMS_KO.length) {
    const rows = stateByGroup(past.filter((e) => e.states), dayMaster);
    for (const fam of [...new Set(todayFamilies)]) {
      const r = rows.find((x) => x.group === fam);
      if (!r?.top || r.top.count < RECALL_MIN || r.top.level === 2) continue;   // "보통"은 경향으로 말하지 않는다
      tendency.push({ family: fam, familyWord: FAMILY_WORD[fam], axisLabel: r.label, word: r.top.word, count: r.top.count, n: r.n });
    }
  }
  return same.length || tendency.length ? { same, tendency } : null;
}

// ---------- 글에 넣는 기록 한 줄 (2026-11-17 앱 주인 "추천대로" — 기록 반영 설계 Q3·Q5~Q8) ----------
// 코드가 사실 한 줄을 정하고 편집자(모델)는 둘째 문단에 한 문장으로 녹인다. 행복도 숫자는 쓰지 않고(Q6) 기분·있었던 일만,
// 날짜·요일·숫자(아라비아)는 쓰지 않는다 — 지시가 글에서 막는 것들이다. 같은 줄은 7일에 한 번, 횟수가 바뀌면(새 사실) 바로(Q7).
// 기록이 운세와 반대여도 말한다 — 판정은 바꾸지 않는다(Q8, 지시가 "까닭처럼 묶지 않는다").
export interface RecordLine { key: string; text: string }
/** 글 속 갈래 이름 — 카드의 FAMILY_WORD에서 괄호를 뺀 꼴 */
export const TEXT_FAMILY: Record<TenGodFamily, string> = { 비겁: "나를 내세우는 기운", 식상: "표현하는 기운", 재성: "돈·실속의 기운", 관성: "책임의 기운", 인성: "생각·배움의 기운" };
const COUNT = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
const TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
/** 1~99 → 고유어 횟수("세", "열두"). 글에 아라비아 숫자를 쓰지 않는다(검사기 number) */
export function countWord(n: number): string {
  if (n < 1 || n > 99 || !Number.isInteger(n)) return "여러";
  if (n <= 10) return COUNT[n]!;
  const t = Math.floor(n / 10), o = n % 10;
  return `${TENS[t]}${o ? ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"][o] : ""}`.replace(/^스물한?$/, (m) => (m === "스물" ? "스무" : m));
}
const hasBatchim = (s: string): boolean => { const c = s.charCodeAt(s.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
/** 기분 이름에 이미 가운뎃점이 있다('우울·슬픔') — 낱말 사이는 쉼표로 */
const quoted = (words: string[]): string => words.map((w) => `'${w}'`).join(", ");
const eul = (words: string[]): string => (hasBatchim(words.at(-1)!) ? "을" : "를");

/**
 * 오늘 글에 넣을 기록 한 줄. 같은 일진이던 지난번 → 오늘 온 갈래의 경향 순으로, 최근 7일 안에 쓴 줄(key)은 건너뛴다. 없으면 null.
 * recentKeys: 최근 7일 운세에 들어간 RecordLine.key
 */
export function recordLineOf(recall: FortuneRecall | null, recentKeys: readonly string[] = []): RecordLine | null {
  if (!recall) return null;
  const used = new Set(recentKeys);
  const cands: RecordLine[] = [];
  const last = recall.same[0];
  if (last) {
    const words = [...last.moods, ...last.states].slice(0, 3);
    if (words.length) cands.push({ key: `same:${last.date}`, text: `오늘과 같은 기운이 돌던 지난번에는 ${quoted(words)}${eul(words)} 고르셨어요.` });
  }
  for (const t of recall.tendency) {
    const w = `${t.axisLabel} ${t.word}`;
    cands.push({ key: `tend:${t.family}:${t.axisLabel}:${t.word}:${t.count}/${t.n}`, text: `${TEXT_FAMILY[t.family]}이 온 날 ${countWord(t.n)} 번 중 ${countWord(t.count)} 번은 '${w}'${eul([w])} 고르셨어요.` });
  }
  return cands.find((c) => !used.has(c.key)) ?? null;
}

/**
 * 2026-11-17 앱 주인 "빠지면 코드가 넣기": 편집자가 글감.내기록을 뺐으면 그 문장을 그대로 둘째 문단 마지막 문장(마무리) 바로 앞에 넣는다.
 * 지시는 늘리지 않는다. 따옴표 속 말 하나라도 본문에 이미 있으면 녹인 것으로 보고 그대로 둔다. 첫 문단 문장 수(split)는 바뀌지 않는다
 */
export function placeRecordLine(sentences: readonly string[], split: number | undefined, line: string | null | undefined): string[] {
  if (!line) return [...sentences];
  const words = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]!.split("·")[0]!);
  const all = sentences.join(" ");
  if (words.length ? words.some((w) => all.includes(w)) : all.includes(line)) return [...sentences];
  const out = [...sentences];
  const secondStart = split && split < out.length ? split : 0;
  const at = out.length - secondStart >= 2 ? out.length - 1 : out.length;
  out.splice(at, 0, line);
  return out;
}
