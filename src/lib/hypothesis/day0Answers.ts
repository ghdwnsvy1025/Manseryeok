/**
 * Day 0 — 사용자가 카드를 보고 "지금 맞는 것 같다"고 답한 내용.
 *
 * ⚠ 절대 규칙: 이 답은 가설 판정에 쓰지 않는다.
 *
 * 왜냐면 판정에 쓰는 순간 이 앱의 유일한 무기가 무너지기 때문이다.
 * 사용자가 "맞다"고 답한 카드는 나중에 기록할 때 무의식적으로 그 방향으로
 * 적히기 쉽다(확증편향). 그 답을 판정에 섞으면 "데이터로 검증했다"는 말이
 * 거짓이 된다. 판정의 입력은 오직 체크인 기록(DayRecord)뿐이다.
 *
 * 그럼 이 답은 어디에 쓰나 — 나중에 실제 판정과 **대조**하는 데만 쓴다.
 *   "당신은 5장이 맞다고 봤는데, 90일 기록으로는 3장만 맞았습니다."
 * 오염이 아니라 콘텐츠가 된다.
 *
 * 저장은 로컬만 한다. 사주 프로필별로 나눠 담는다(같은 기기에서 프로필을
 * 바꿔도 섞이지 않게). `journal/preferences.ts` 의 키 방식을 그대로 따랐다.
 */

export type Day0Guess = "agree" | "disagree" | "unsure";

export type Day0Answers = {
  /** 규칙 id → 사용자의 답 */
  guesses: Record<string, Day0Guess>;
  /** 이 카드 덱을 만든 규칙 id 순서 — 나중에 대조할 때 필요 */
  ruleIds: string[];
  answeredAt: string;
  version: string;
};

export const DAY0_ANSWERS_VERSION = "day0-answers-v1";

const KEY_PREFIX = "manseryeok_hypothesis_day0_v1:";
const KEY_FALLBACK = "manseryeok_hypothesis_day0_v1";

function storageKey(sajuProfileId: string | null | undefined): string {
  return sajuProfileId ? `${KEY_PREFIX}${sajuProfileId}` : KEY_FALLBACK;
}

export function loadDay0Answers(
  sajuProfileId: string | null | undefined
): Day0Answers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(sajuProfileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Day0Answers;
    if (!parsed || typeof parsed !== "object" || !parsed.guesses) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDay0Answers(
  sajuProfileId: string | null | undefined,
  guesses: Record<string, Day0Guess>,
  ruleIds: string[]
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Day0Answers = {
      guesses,
      ruleIds,
      answeredAt: new Date().toISOString(),
      version: DAY0_ANSWERS_VERSION,
    };
    localStorage.setItem(storageKey(sajuProfileId), JSON.stringify(payload));
  } catch {
    // 저장 실패해도 화면은 계속 진행한다. 이건 부가 정보다.
  }
}

/** 이 프로필에서 Day 0 카드를 이미 봤는가 */
export function hasSeenDay0Cards(
  sajuProfileId: string | null | undefined
): boolean {
  return loadDay0Answers(sajuProfileId) != null;
}

export function clearDay0Answers(
  sajuProfileId: string | null | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(sajuProfileId));
  } catch {
    // 무시
  }
}

/** "맞다고 본" 카드 수 — 요약 화면용 */
export function countAgreed(answers: Day0Answers | null): number {
  if (!answers) return 0;
  return Object.values(answers.guesses).filter((g) => g === "agree").length;
}
