// Google 연결 안내 카드를 언제 보여 줄지 (docs/ANON_START.md 2절).
// 익명 사용자에게만. 첫 기록 뒤 한 번, 기록 7건째 한 번 더. 설정 화면에는 늘 있으므로 여기서는 두 번이 끝.

export interface LinkPromptInput {
  isAnonymous: boolean;
  /** 지금까지 남긴 기록 수 (오늘 것 포함) */
  entryCount: number;
  /** 지금까지 안내 카드를 보여 준 횟수 (night_profiles.link_prompt_count) */
  promptCount: number;
}

export const LINK_PROMPT_SECOND_AT = 7;

export function shouldShowLinkPrompt({ isAnonymous, entryCount, promptCount }: LinkPromptInput): boolean {
  if (!isAnonymous || entryCount < 1) return false;
  if (promptCount <= 0) return true;
  if (promptCount === 1 && entryCount >= LINK_PROMPT_SECOND_AT) return true;
  return false;
}

/** Google 버튼 문구. 익명이면 "연결", 세션이 없으면 "로그인", 이미 연결됐으면 보여 주지 않는다(null) */
export function googleButtonLabel(session: { isAnonymous: boolean } | null): string | null {
  if (!session) return "Google로 시작하기";
  return session.isAnonymous ? "Google로 연결하기" : null;
}
