// 세션 쿠키 하루 한 번 재발급 (docs/ANON_START.md 8절) — Safari가 스크립트 쿠키를 7일로 줄이는 것에 대한 대응
import { describe, expect, test } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { REISSUE_MARK, reissueAuthCookies } from "@/lib/supabase/reissue";

const AUTH = "sb-abc-auth-token";

function req(cookie: string): NextRequest {
  return new NextRequest("http://localhost/", { headers: cookie ? { cookie } : {} });
}

describe("reissueAuthCookies", () => {
  test("표시 쿠키가 없고 세션 쿠키가 있으면 같은 값을 400일 서버 쿠키로 다시 내리고 표시 쿠키(하루)를 남긴다", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req(`${AUTH}=tok; ${AUTH}.1=part`), res)).toBe(true);
    const auth = res.cookies.get(AUTH);
    expect(auth?.value).toBe("tok");
    expect(auth?.maxAge).toBe(400 * 24 * 60 * 60);
    expect(auth?.httpOnly).toBe(false);
    expect(res.cookies.get(`${AUTH}.1`)?.value).toBe("part");
    const mark = res.cookies.get(REISSUE_MARK);
    expect(mark?.maxAge).toBe(24 * 60 * 60);
    expect(mark?.httpOnly).toBe(true);
  });

  test("오늘 이미 다시 내렸으면(표시 쿠키) 아무것도 안 한다", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req(`${AUTH}=tok; ${REISSUE_MARK}=1`), res)).toBe(false);
    expect(res.cookies.getAll()).toEqual([]);
  });

  test("세션 쿠키가 없으면(첫 방문) 표시 쿠키도 남기지 않는다", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req(""), res)).toBe(false);
    expect(res.cookies.getAll()).toEqual([]);
  });

  test("이번 응답이 이미 새로 쓴 쿠키(토큰 갱신)는 덮어쓰지 않는다", () => {
    const res = NextResponse.next();
    res.cookies.set(AUTH, "fresh", { path: "/" });
    expect(reissueAuthCookies(req(`${AUTH}=old`), res)).toBe(true);
    expect(res.cookies.get(AUTH)?.value).toBe("fresh");
    expect(res.cookies.get(REISSUE_MARK)).toBeTruthy();
  });
});
