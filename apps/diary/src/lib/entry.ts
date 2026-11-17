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
 * 영역별 점수 (2026-10-31): 여섯 영역을 5단계 도장으로, 매긴 영역만(선택). 2026-11-01부터 하루 행복도는 따로 직접 매기고(필수) 영역이 바꾸지 않는다.
 * 영역이 없는 기록(이전 기록)은 happiness만 있다. 매기지 않은 영역은 없음(null)이지 3이 아니다.
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

/**
 * 오늘 있었던 일 — 상태값 (2026-11-14 사용자 결정, 0007_entry_states.sql).
 * 영역 점수는 "평가"라 별일 없는 날엔 답할 것이 없었다. 상태는 "묘사"라 매일 고를 수 있고, 운세가 예고한 것("돈이 새기 쉬운 날")을 그대로 맞춰 볼 수 있다.
 * 축은 여섯: 하루의 속도(공통) + 십신 다섯 갈래에 하나씩(비겁 = 사람, 식상 = 말·표현, 재성 = 돈, 관성 = 책임, 인성 = 생각).
 *   관성을 "바쁨"으로, 인성을 "쉼"으로 두면 둘이 같은 축이 돼(바쁨 = 못 쉼) 속도를 공통 축으로 빼고 관성 = 책임, 인성 = 생각으로 갈랐다.
 * 단계는 1~3, 3이 그 갈래가 세게 드러난 쪽(levels[0]이 1). 고른 축만 저장한다. tags는 갈래별 세부 낱말 키(펼쳤을 때만 고른다).
 * 낱말은 운세 단락 사전의 장면에서 뽑았다 — 운세가 "밥이나 무언가를 사 주고 싶어져요"라고 하면 "사 줬음"이 확인 칸이다.
 */
export const STATE_AXES = [
  { key: "pace", label: "하루의 속도", group: null, levels: ["여유", "보통", "바쁨"], tags: [] },
  {
    key: "people", label: "사람", group: "비겁", levels: ["잘 맞았음", "무난", "마찰 있었음"],
    tags: [{ key: "fight", label: "다툼" }, { key: "compare", label: "비교·경쟁" }, { key: "myway", label: "내 뜻대로 밀었음" }, { key: "help", label: "도움 주고받음" }, { key: "newface", label: "새 사람" }, { key: "alone", label: "혼자 보냄" }],
  },
  {
    key: "express", label: "말·표현", group: "식상", levels: ["조용히 보냄", "보통", "말 많이 함"],
    tags: [{ key: "held", label: "할 말을 참음" }, { key: "harsh", label: "말이 셌음" }, { key: "made", label: "뭔가 만듦·씀" }, { key: "play", label: "먹고 놀았음" }],
  },
  {
    key: "money", label: "돈", group: "재성", levels: ["거의 안 씀", "평소만큼", "많이 나감"],
    tags: [{ key: "impulse", label: "충동구매" }, { key: "treat", label: "사 줬음" }, { key: "income", label: "들어온 돈" }, { key: "tidy", label: "정리·점검" }, { key: "offer", label: "좋은 제안" }],
  },
  {
    key: "duty", label: "책임", group: "관성", levels: ["가벼웠음", "보통", "무거웠음"],
    tags: [{ key: "deadline", label: "압박·마감" }, { key: "praise", label: "인정·칭찬" }, { key: "cleared", label: "미룬 일 끝냄" }, { key: "derailed", label: "계획이 틀어짐" }],
  },
  {
    key: "mind", label: "생각", group: "인성", levels: ["머리 비웠음", "보통", "생각 많았음"],
    tags: [{ key: "study", label: "배움·공부" }, { key: "ruminate", label: "곱씹음" }, { key: "lean", label: "누군가에게 기댐" }, { key: "care", label: "몸을 돌봄" }, { key: "heavy", label: "몸이 무거움" }],
  },
] as const;
export type StateKey = (typeof STATE_AXES)[number]["key"];
export type StateLevel = 1 | 2 | 3;
/** 고른 축만 들어간다. tags = 세부 낱말 키 */
export type States = Partial<Record<StateKey, StateLevel>> & { tags?: string[] };
export const STATE_TAG_KEYS: readonly string[] = STATE_AXES.flatMap((a) => a.tags.map((t) => t.key));
export const STATE_TAG_LABEL: Record<string, string> = Object.fromEntries(STATE_AXES.flatMap((a) => a.tags.map((t) => [t.key, t.label])));
/** 고른 축 수 (세부 낱말은 세지 않는다) */
export function stateCount(s: States | null | undefined): number {
  return s ? STATE_AXES.filter((a) => typeof s[a.key] === "number").length : 0;
}
/**
 * 축 이름 없이 혼자 읽히는 말 [1단계, 3단계]. 줄 안의 단계 말("많이 나감")은 축 이름 옆에서만 읽혀서, 날짜 상세·통계 문장에는 이 말을 쓴다.
 * 축 이름을 그대로 붙이면 "생각 생각 많았음", "말·표현 말 많이 함"처럼 겹쳤다(명세 37 디자이너 보고).
 */
const STATE_SAY: Record<StateKey, readonly [string, string]> = {
  pace: ["여유", "바쁨"],
  people: ["사람과 잘 맞음", "사람과 마찰"],
  express: ["조용히 보냄", "말 많이 함"],
  money: ["돈 거의 안 씀", "돈 많이 나감"],
  duty: ["책임 가벼움", "책임 무거움"],
  mind: ["머리 비움", "생각 많음"],
};
/** 한 축의 한 단계를 혼자 읽히는 말로. 가운데(2)는 "돈 평소만큼"처럼 축 이름을 붙인다(속도는 "속도 보통") */
export function stateSay(key: StateKey, level: StateLevel): string {
  if (level === 2) {
    const a = STATE_AXES.find((x) => x.key === key)!;
    return `${key === "pace" ? "속도" : a.label} ${a.levels[1]}`;
  }
  return STATE_SAY[key][level === 1 ? 0 : 1];
}
/** 화면에 보일 그날의 상태 말: "바쁨", "돈 많이 나감" … (보통은 뺀다), 그다음 세부 낱말 */
export function stateWords(s: States | null | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const a of STATE_AXES) {
    const lv = s[a.key];
    if (typeof lv !== "number" || lv === 2) continue;
    out.push(stateSay(a.key, lv));
  }
  for (const t of s.tags ?? []) if (STATE_TAG_LABEL[t]) out.push(STATE_TAG_LABEL[t]!);
  return out;
}

/**
 * 그래서 마음은 — 기분 고르기 네 갈래 (2026-11-14). 45개가 많다는 사용자 말에 따라 비슷한 말을 합쳐 21개만 고르게 한다.
 * name = 저장되는 이름(예전 목록의 이름 그대로 — 지난 기록과 통계가 이어진다), label = 화면 말, merges = 이 이름으로 묶는 예전 기분.
 * "바쁨·생각 많음·아픔"은 기분이 아니라 상태라 고르기에서 뺐다(지난 기록에는 남는다).
 */
export const MOOD_PICK = [
  { key: "up", label: "들뜸", moods: [
    { name: "기쁨", label: "기쁨·신남", merges: ["행복함", "즐거움", "신남"] },
    { name: "설렘", label: "설렘", merges: ["희망참"] },
    { name: "뿌듯함", label: "뿌듯함", merges: [] },
    { name: "자신감", label: "자신감", merges: [] },
    { name: "재미있음", label: "재미", merges: [] },
  ] },
  { key: "calm", label: "편안", moods: [
    { name: "평온", label: "평온·홀가분", merges: ["편안함", "홀가분함", "여유로움"] },
    { name: "감사함", label: "감사", merges: [] },
    { name: "따뜻함", label: "따뜻함·사랑받음", merges: ["사랑받음"] },
    { name: "든든함", label: "든든함", merges: [] },
    { name: "만족스러움", label: "만족", merges: [] },
  ] },
  { key: "sharp", label: "날카로움", moods: [
    { name: "짜증남", label: "짜증·화", merges: ["분노", "스트레스"] },
    { name: "불안", label: "불안·걱정", merges: ["걱정됨"] },
    { name: "긴장됨", label: "긴장", merges: [] },
    { name: "답답함", label: "답답함", merges: [] },
    { name: "서운함", label: "서운함·실망", merges: ["실망스러움"] },
    { name: "질투", label: "질투", merges: [] },
  ] },
  { key: "low", label: "가라앉음", moods: [
    { name: "지침", label: "지침·무기력", merges: ["피곤함", "무기력함"] },
    { name: "우울함", label: "우울·슬픔", merges: ["슬픔"] },
    { name: "외로움", label: "외로움·그리움", merges: ["그리움"] },
    { name: "후회스러움", label: "후회·부끄러움", merges: ["부끄러움"] },
    { name: "멍함", label: "멍함·심심함", merges: ["무덤덤", "무난함", "심심함"] },
  ] },
] as const;
const MOOD_CANON: Record<string, string> = Object.fromEntries(MOOD_PICK.flatMap((g) => g.moods.flatMap((m) => [[m.name, m.name], ...m.merges.map((x) => [x, m.name])])));
/** 예전 기분 이름 → 지금 고르기의 이름. 묶이지 않는 이름(바쁨·생각 많음·아픔, 목록 밖)은 그대로 */
export function canonicalMood(m: string): string {
  return MOOD_CANON[m] ?? m;
}
/** 지금 고르기에 있는 이름인가 */
export function isPickMood(m: string): boolean {
  return MOOD_CANON[m] === m;
}
export const MOOD_PICK_LABEL: Record<string, string> = Object.fromEntries(MOOD_PICK.flatMap((g) => g.moods.map((m) => [m.name, m.label])));

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
  /** 오늘 있었던 일 (2026-11-14). 고른 것이 없으면 null */
  states: States | null;
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
    /** { pace: "3", money: "3", …, tags: ["treat"] } 축 키 → 1~3, tags → 세부 낱말 키. 빈 값은 안 고른 것 */
    states?: unknown;
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
  const states: States = {};
  if (raw.states && typeof raw.states === "object") {
    const src = raw.states as Record<string, unknown>;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v === null || v === undefined || v === "") continue;
      if (k === "tags") {
        const list = [...new Set((Array.isArray(v) ? v : [v]).map(String).filter(Boolean))];
        if (list.some((t) => !STATE_TAG_KEYS.includes(t))) return { ok: false, error: "목록에 없는 상태가 들어 있어요." };
        if (list.length) states.tags = list;
        continue;
      }
      if (!STATE_AXES.some((a) => a.key === k)) return { ok: false, error: "목록에 없는 상태가 들어 있어요." };
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 3) return { ok: false, error: "상태 값이 올바르지 않아요." };
      states[k as StateKey] = n as StateLevel;
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

  const value: EntryInput = { entryDate, happiness, moods: moods as Mood[], note: text || null, areas: areaCount(areas) === 0 ? null : areas, states: stateCount(states) === 0 && !states.tags?.length ? null : states, tomorrowNote: tomorrow || null };
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
