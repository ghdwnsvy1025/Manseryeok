// "이 기기에서 쓰던 계정"을 localStorage에 적어 둔다 (docs/ANON_START.md 8절). 브라우저 전용, 비밀 없음(id 앞부분과 익명 여부만).
// 세션 쿠키가 사라지면 AnonBoot가 예전엔 아무 말 없이 새 익명 계정을 만들었다 → 생년월일 입력부터 다시. 이제 이 기록이 있으면
// 새로 만들기 전에 /restore에서 "Google로 기록 찾기 / 새로 시작"을 묻는다. 저장소가 통째로 다른 창(카톡 안 브라우저 등)에는
// 이 기록도 없으므로 거기선 예전처럼 바로 시작한다.

export const LAST_ACCOUNT_KEY = "night_last_account";

export interface LastAccount {
  /** user_id 앞 8자 — 같은 계정인지 가늠만 한다 */
  id: string;
  /** Google을 붙이지 않은 익명 계정이었는지. 익명이면 세션을 잃은 뒤 되찾을 길이 없다 */
  anonymous: boolean;
}

export function parseLastAccount(raw: string | null): LastAccount | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastAccount>;
    return typeof v.id === "string" && v.id && typeof v.anonymous === "boolean" ? { id: v.id, anonymous: v.anonymous } : null;
  } catch {
    return null;
  }
}

export function readLastAccount(): LastAccount | null {
  try {
    return parseLastAccount(localStorage.getItem(LAST_ACCOUNT_KEY));
  } catch {
    return null;
  }
}

export function rememberAccount(userId: string, anonymous: boolean): void {
  try {
    localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify({ id: userId.slice(0, 8), anonymous }));
  } catch {
    /* 저장소를 못 쓰면 잃었을 때 묻는 단계만 빠진다 */
  }
}

export function forgetAccount(): void {
  try {
    localStorage.removeItem(LAST_ACCOUNT_KEY);
  } catch {
    /* 무시 */
  }
}
