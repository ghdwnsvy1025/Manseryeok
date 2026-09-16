/**
 * 한글 조사 처리
 *
 * "나무가" / "불이" 처럼 앞 글자의 받침에 따라 조사가 달라진다.
 * 사용자가 바로 읽는 문장이라 틀리면 티가 크다.
 *
 * "쇠(金)" 처럼 괄호가 붙은 경우, 조사는 괄호 앞 한글을 기준으로 정한다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 마지막 한글 음절에 받침이 있는가 */
export function hasFinalConsonant(word: string): boolean {
  // 괄호와 공백을 걷어내고 마지막 한글 음절을 찾는다
  const stripped = word.replace(/\s*\([^)]*\)\s*$/, "").trim();

  for (let i = stripped.length - 1; i >= 0; i -= 1) {
    const code = stripped.charCodeAt(i);
    if (code >= HANGUL_START && code <= HANGUL_END) {
      return (code - HANGUL_START) % 28 !== 0;
    }
  }
  return false;
}

/** 이/가 */
export function iGa(word: string): string {
  return hasFinalConsonant(word) ? "이" : "가";
}

/** 은/는 */
export function eunNeun(word: string): string {
  return hasFinalConsonant(word) ? "은" : "는";
}

/** 을/를 */
export function eulReul(word: string): string {
  return hasFinalConsonant(word) ? "을" : "를";
}

/** 과/와 */
export function gwaWa(word: string): string {
  return hasFinalConsonant(word) ? "과" : "와";
}

/** "나무(木)" + 이/가 → "나무(木)가" */
export function withIGa(word: string): string {
  return `${word}${iGa(word)}`;
}

export function withEunNeun(word: string): string {
  return `${word}${eunNeun(word)}`;
}
