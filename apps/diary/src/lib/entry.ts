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

/** 기분 색 구분 (2026-10-09 Q3): 긍정 = 금빛, 무덤덤 = 색 없음, 부정 = 차분한 남색. 빨강 없음. 화면은 data-tone으로 칠한다 */
export type MoodTone = "pos" | "neutral" | "neg";
const POSITIVE_MOODS: readonly string[] = ["기쁨", "뿌듯함", "설렘", "평온"];
export function moodTone(m: string): MoodTone {
  if (POSITIVE_MOODS.includes(m)) return "pos";
  if (m === "무덤덤") return "neutral";
  return "neg";
}

export const MAX_MOODS = 3;
export const MAX_NOTE = 500;
/** 기록할 수 있는 가장 이른 날짜 (레거시 이관분 포함) */
export const EARLIEST_ENTRY_DATE = "2020-01-01";

/** 오늘의 작은 약속(톤 v3.2): 운세 "하면 좋아요" 한 줄을 지켰는지. 약속이 없던 날(운세 캐시 없음)은 null */
export const PROMISES = ["kept", "missed", "na"] as const;
export type Promise_ = (typeof PROMISES)[number];
export const MAX_PROMISE_TEXT = 200;

export interface EntryInput {
  entryDate: string;
  happiness: number;
  moods: Mood[];
  note: string | null;
  promise: Promise_ | null;
  /** 그날 약속한 문장(운세 do). 운세가 나중에 바뀌어도 무엇을 약속했는지 남는다 */
  promiseText: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** 기록 날짜 규칙 하나로: 형식 · 미래 금지 · 2020-01-01 이후. 저장(validateEntry)과 지우기(deleteEntryAction)가 같이 쓴다 */
export function validateEntryDate(raw: unknown, today: string = todayKST()): Validation<string> {
  const entryDate = typeof raw === "string" ? raw : "";
  if (!parseYmd(entryDate)) return { ok: false, error: "날짜가 올바르지 않아요." };
  if (entryDate > today) return { ok: false, error: "아직 오지 않은 날은 기록할 수 없어요." };
  if (entryDate < EARLIEST_ENTRY_DATE) return { ok: false, error: "너무 오래된 날짜예요." };
  return { ok: true, value: entryDate };
}

export function validateEntry(
  raw: { entryDate: unknown; happiness: unknown; moods: unknown; note: unknown; promise?: unknown; promiseText?: unknown },
  today: string = todayKST(),
): Validation<EntryInput> {
  const dateChecked = validateEntryDate(raw.entryDate, today);
  if (!dateChecked.ok) return dateChecked;
  const entryDate = dateChecked.value;

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

  // 약속: 없거나 빈 값이면 null. 목록 밖의 값은 거부
  const promiseRaw = typeof raw.promise === "string" ? raw.promise.trim() : "";
  if (promiseRaw && !(PROMISES as readonly string[]).includes(promiseRaw)) {
    return { ok: false, error: "약속 상태가 올바르지 않아요." };
  }
  const promise = promiseRaw ? (promiseRaw as Promise_) : null;
  const promiseTextRaw = typeof raw.promiseText === "string" ? raw.promiseText.trim().slice(0, MAX_PROMISE_TEXT) : "";
  // 약속 상태가 없으면 문장도 남기지 않는다
  const promiseText = promise && promiseTextRaw ? promiseTextRaw : null;

  return { ok: true, value: { entryDate, happiness, moods: moods as Mood[], note: text || null, promise, promiseText } };
}
