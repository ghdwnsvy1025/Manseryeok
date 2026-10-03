// 기록 입력 규칙. 화면과 서버가 같은 함수를 쓴다.
import { parseYmd, todayKST } from "./time";

/** 레거시와 같은 13개 (이관한 기록의 기분이 그대로 맞도록) */
export const MOODS = [
  "기쁨",
  "뿌듯함",
  "설렘",
  "평온",
  "무덤덤",
  "지침",
  "답답함",
  "짜증남",
  "불안",
  "분노",
  "슬픔",
  "우울함",
  "후회스러움",
] as const;
export type Mood = (typeof MOODS)[number];

export const MAX_MOODS = 3;
export const MAX_NOTE = 500;
/** 기록할 수 있는 가장 이른 날짜 (레거시 이관분 포함) */
export const EARLIEST_ENTRY_DATE = "2020-01-01";

export interface EntryInput {
  entryDate: string;
  happiness: number;
  moods: Mood[];
  note: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateEntry(
  raw: { entryDate: unknown; happiness: unknown; moods: unknown; note: unknown },
  today: string = todayKST(),
): Validation<EntryInput> {
  const entryDate = typeof raw.entryDate === "string" ? raw.entryDate : "";
  if (!parseYmd(entryDate)) return { ok: false, error: "날짜가 올바르지 않아요." };
  if (entryDate > today) return { ok: false, error: "아직 오지 않은 날은 기록할 수 없어요." };
  if (entryDate < EARLIEST_ENTRY_DATE) return { ok: false, error: "너무 오래된 날짜예요." };

  const happiness = Number(raw.happiness);
  if (!Number.isInteger(happiness) || happiness < 1 || happiness > 10) {
    return { ok: false, error: "오늘 행복도를 1부터 10 사이로 골라 주세요." };
  }

  const list = Array.isArray(raw.moods) ? raw.moods : raw.moods == null ? [] : [raw.moods];
  const moods = [...new Set(list.map(String))];
  if (moods.some((m) => !(MOODS as readonly string[]).includes(m))) {
    return { ok: false, error: "목록에 없는 기분이 들어 있어요." };
  }
  if (moods.length > MAX_MOODS) return { ok: false, error: `기분은 ${MAX_MOODS}개까지 고를 수 있어요.` };

  const text = typeof raw.note === "string" ? raw.note.trim() : "";
  if (text.length > MAX_NOTE) return { ok: false, error: `메모는 ${MAX_NOTE}자까지 쓸 수 있어요.` };

  return { ok: true, value: { entryDate, happiness, moods: moods as Mood[], note: text || null } };
}
