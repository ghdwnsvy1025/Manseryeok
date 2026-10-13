// 로그인·온보딩·저장 뒤 돌아갈 "next" 값 검사. 서버·클라이언트 공용 (비밀 없음).
// `startsWith("/") && !startsWith("//")`만으로는 `/\evil.com`이 통과한다 — WHATWG URL은 특수 스킴에서 `\`를 `/`로 보므로
// Node와 브라우저 모두 `https://evil.com/`으로 해석한다 (전체검토 2026-10-14 B-H2). 그래서 실제로 URL을 풀어 출처가 같은지 본다.

const BASE = "http://next.invalid";

/** 앱 안 경로면 pathname+search+hash(정규화된 형태)를, 아니면 fallback을 돌려준다 */
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  try {
    const u = new URL(raw, BASE);
    if (u.origin !== BASE) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
