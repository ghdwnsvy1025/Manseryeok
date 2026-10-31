// 기록 입력 규칙. 화면과 서버가 같은 함수를 쓴다.
import { parseYmd, todayKST } from "./time";

/**
 * 기분 (2026-10-31 사용자 결정: 개수 제한 없음, 세 무리로 나눠 늘림).
 * 예전 20개는 이름 그대로 모두 남긴다 — 이관·지난 기록의 기분이 그대로 맞는다. 무리 순서가 곧 화면 순서.
 */
export const MOOD_GROUPS = {
  pos: ["기쁨", "행복함", "즐거움", "설렘", "신남", "뿌듯함", "만족스러움", "감사함", "평온", "편안함", "여유로움", "홀가분함", "든든함", "재미있음", "자신감", "희망참", "따뜻함", "사랑받음"],
  neutral: ["무덤덤", "무난함", "멍함", "심심함", "바쁨", "생각 많음", "그리움"],
  neg: ["피곤함", "지침", "무기력함", "우울함", "슬픔", "외로움", "서운함", "불안", "걱정됨", "긴장됨", "스트레스", "답답함", "짜증남", "분노", "실망스러움", "후회스러움", "질투", "부끄러움", "아픔"],
} as const;
export const MOODS = [...MOOD_GROUPS.pos, ...MOOD_GROUPS.neutral, ...MOOD_GROUPS.neg] as const;
export type Mood = (typeof MOODS)[number];

/** 기분 색 구분 (2026-10-09 Q3): 긍정 = 금빛, 그저 그런 = 색 없음, 부정 = 차분한 남색. 빨강 없음. 화면은 data-tone으로 칠한다 */
export type MoodTone = "pos" | "neutral" | "neg";
export function moodTone(m: string): MoodTone {
  if ((MOOD_GROUPS.pos as readonly string[]).includes(m)) return "pos";
  if ((MOOD_GROUPS.neutral as readonly string[]).includes(m)) return "neutral";
  return "neg";
}

/**
 * 영역별 행복도 (2026-10-31 사용자 결정): 여섯 영역을 5단계 도장으로, 매긴 영역만. 하루 행복도 = 매긴 영역 평균 × 2 (1~10 반올림).
 * 영역이 없는 기록(이전 기록)은 happiness만 있다.
 */
export const AREAS = [
  { key: "work", label: "일·공부" },
  { key: "money", label: "돈" },
  { key: "health", label: "건강" },
  { key: "family", label: "가족" },
  { key: "love", label: "연애" },
  { key: "people", label: "대인관계" },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];
export type Areas = Partial<Record<AreaKey, number>>;
/** 5단계 도장의 말 (1 = 아주 힘듦 … 5 = 아주 좋음) */
export const AREA_LEVELS = ["아주 힘듦", "힘듦", "보통", "좋음", "아주 좋음"] as const;

export function areaCount(a: Areas | null | undefined): number {
  return a ? AREAS.filter((x) => typeof a[x.key] === "number").length : 0;
}

export const MAX_NOTE = 500;
/** 내일의 나에게 쪽지 (2026-10-31, "오늘 해볼 일" 자리). 다음 날 오늘 화면 위에 펼쳐진다 */
export const MAX_TOMORROW_NOTE = 100;
/** 기록할 수 있는 가장 이른 날짜 (레거시 이관분 포함) */
export const EARLIEST_ENTRY_DATE = "2020-01-01";

/**
 * 오늘의 작은 약속(톤 v3.2): 운세 "하면 좋아요" 한 줄을 지켰는지. 2026-10-31 쓰기 화면에서 뺐다(내일의 나에게 쪽지로).
 * 지난 기록의 값은 DB에 남기고 읽는 규칙만 둔다 — 폼이 보내지 않으면(undefined) 저장할 때 건드리지 않는다
 */
export const PROMISES = ["kept", "missed", "na"] as const;
export type Promise_ = (typeof PROMISES)[number];
export const MAX_PROMISE_TEXT = 200;

export interface EntryInput {
  entryDate: string;
  happiness: number;
  moods: Mood[];
  note: string | null;
  /** 영역별 5단계. 매긴 영역이 없으면 null(이전 방식 기록) */
  areas: Areas | null;
  /** 내일의 나에게 쪽지 */
  tomorrowNote: string | null;
  /** undefined = 폼에 약속이 없었다 → 저장할 때 지난 값을 건드리지 않는다 */
  promise?: Promise_ | null;
  /** 그날 약속한 문장(운세 do). 운세가 나중에 바뀌어도 무엇을 약속했는지 남는다 */
  promiseText?: string | null;
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
  raw: {
    entryDate: unknown;
    /** 하루 행복도 1~10 (필수, 직접 매긴 값) */
    happiness?: unknown;
    moods: unknown;
    note: unknown;
    /** { work: "4", … } 영역 키 → 1~5. 빈 값은 안 매긴 것 */
    areas?: unknown;
    tomorrowNote?: unknown;
    promise?: unknown;
    promiseText?: unknown;
  },
  today: string = todayKST(),
): Validation<EntryInput> {
  const dateChecked = validateEntryDate(raw.entryDate, today);
  if (!dateChecked.ok) return dateChecked;
  const entryDate = dateChecked.value;

  const areas: Areas = {};
  if (raw.areas && typeof raw.areas === "object") {
    const src = raw.areas as Record<string, unknown>;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v === null || v === undefined || v === "") continue;
      if (!AREAS.some((a) => a.key === k)) return { ok: false, error: "목록에 없는 영역이 들어 있어요." };
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: "영역 점수가 올바르지 않아요." };
      areas[k as AreaKey] = n;
    }
  }
  // 2026-11-01 사용자 결정: 행복도는 직접 매긴 값 하나(필수). 영역은 골라도 안 골라도 되고, 행복도를 바꾸지 않는다
  //   (영역 평균 × 2는 다섯 영역이 보통이고 하나가 아주 나빴던 날처럼 내 느낌과 어긋났다. 영역 이전 기록 129개와도 같은 모양)
  const happiness = Number(raw.happiness);
  if (raw.happiness === "" || raw.happiness == null || !Number.isInteger(happiness) || happiness < 1 || happiness > 10) {
    return { ok: false, error: "행복도를 먼저 골라 주세요." };
  }

  const list = Array.isArray(raw.moods) ? raw.moods : raw.moods == null ? [] : [raw.moods];
  const moods = [...new Set(list.map(String))];
  if (moods.some((m) => !(MOODS as readonly string[]).includes(m))) {
    return { ok: false, error: "목록에 없는 기분이 들어 있어요." };
  }

  const text = typeof raw.note === "string" ? raw.note.trim() : "";
  if (text.length > MAX_NOTE) return { ok: false, error: `메모는 ${MAX_NOTE}자까지 쓸 수 있어요.` };

  const tomorrow = typeof raw.tomorrowNote === "string" ? raw.tomorrowNote.trim() : "";
  if (tomorrow.length > MAX_TOMORROW_NOTE) return { ok: false, error: `내일의 나에게 쪽지는 ${MAX_TOMORROW_NOTE}자까지 쓸 수 있어요.` };

  const value: EntryInput = { entryDate, happiness, moods: moods as Mood[], note: text || null, areas: areaCount(areas) === 0 ? null : areas, tomorrowNote: tomorrow || null };
  // 약속: 폼에 없으면(undefined) 건드리지 않는다. 빈 값이면 null. 목록 밖의 값은 거부
  if (raw.promise === undefined) return { ok: true, value };
  const promiseRaw = typeof raw.promise === "string" ? raw.promise.trim() : "";
  if (promiseRaw && !(PROMISES as readonly string[]).includes(promiseRaw)) {
    return { ok: false, error: "약속 상태가 올바르지 않아요." };
  }
  const promise = promiseRaw ? (promiseRaw as Promise_) : null;
  const promiseTextRaw = typeof raw.promiseText === "string" ? raw.promiseText.trim().slice(0, MAX_PROMISE_TEXT) : "";
  // 약속 상태가 없으면 문장도 남기지 않는다
  const promiseText = promise && promiseTextRaw ? promiseTextRaw : null;

  return { ok: true, value: { ...value, promise, promiseText } };
}

/** v3.22: 네 단계 — 8~10 초록(top) · 6~7 금(high) · 4~5 종이(mid) · 0~3 남색(low) */
export function happinessTier(h: number): "top" | "high" | "mid" | "low" {
  return h >= 8 ? "top" : h >= 6 ? "high" : h >= 4 ? "mid" : "low";
}
