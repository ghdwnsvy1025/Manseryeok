import type { NextRequest, NextResponse } from "next/server";

// 세션 쿠키를 서버 응답으로 다시 내려 준다 (docs/ANON_START.md 8절).
// 익명 세션은 브라우저(AnonBoot)에서 document.cookie로 처음 만들어진다. Safari(아이폰 홈 화면 앱 포함)는 스크립트가 만든 쿠키의
// 수명을 7일로 줄여, 일주일 안 열면 세션이 사라지고 AnonBoot가 새 빈 계정을 만들었다. 같은 값을 Set-Cookie로 다시 내려 주면
// 서버가 만든 쿠키가 되어 원래 수명(@supabase/ssr 기본 400일)을 받는다. 하루에 한 번만(표시 쿠키) — 매 응답에 싣지 않는다.

/** 다시 내려 준 날을 적는 쿠키 (하루짜리, 값 없음) */
export const REISSUE_MARK = "night_ck";

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;
const DAY = 24 * 60 * 60;
/** @supabase/ssr DEFAULT_COOKIE_OPTIONS와 같게 — 다른 속성이면 같은 이름의 쿠키가 둘이 될 수 있다 */
const AUTH_OPTIONS = { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * DAY } as const;

/** 미들웨어 끝에서 부른다. 이번 응답이 이미 새로 쓴 쿠키(토큰 갱신)는 건드리지 않는다. 다시 내려 줬으면 true */
export function reissueAuthCookies(request: NextRequest, response: NextResponse): boolean {
  if (request.cookies.has(REISSUE_MARK)) return false;
  const written = new Set(response.cookies.getAll().map((c) => c.name));
  const auth = request.cookies.getAll().filter((c) => AUTH_COOKIE.test(c.name) && !written.has(c.name));
  if (auth.length === 0 && ![...written].some((n) => AUTH_COOKIE.test(n))) return false;
  for (const c of auth) response.cookies.set(c.name, c.value, AUTH_OPTIONS);
  response.cookies.set(REISSUE_MARK, "1", { path: "/", sameSite: "lax", httpOnly: true, maxAge: DAY });
  return true;
}
