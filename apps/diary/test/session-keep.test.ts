// 세션을 잃어 "매번 생년월일 입력"이 되던 일 (docs/ANON_START.md 8절): 쿠키 다시 내려 주기, 쓰던 계정 기록
import { describe, expect, test } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { REISSUE_MARK, reissueAuthCookies } from "@/lib/supabase/reissue";
import { parseLastAccount } from "@/lib/accountMemory";

function req(cookie: string) {
  return new NextRequest("https://night.test/", { headers: cookie ? { cookie } : {} });
}

describe("세션 쿠키 다시 내려 주기", () => {
  test("세션 쿠키(조각 포함)를 서버 쿠키로 400일, 표시 쿠키는 하루", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req("sb-abc-auth-token.0=a; sb-abc-auth-token.1=b; other=x"), res)).toBe(true);
    const set = Object.fromEntries(res.cookies.getAll().map((c) => [c.name, c]));
    expect(set["sb-abc-auth-token.0"].value).toBe("a");
    expect(set["sb-abc-auth-token.1"].maxAge).toBe(400 * 86400);
    expect(set["sb-abc-auth-token.1"].httpOnly).toBe(false);
    expect(set[REISSUE_MARK].maxAge).toBe(86400);
    expect(set.other).toBeUndefined();
  });
  test("오늘 이미 내려 줬으면(표시 쿠키) 아무것도 싣지 않는다", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req(`sb-abc-auth-token=a; ${REISSUE_MARK}=1`), res)).toBe(false);
    expect(res.cookies.getAll()).toEqual([]);
  });
  test("세션이 없으면 아무것도 싣지 않는다", () => {
    const res = NextResponse.next();
    expect(reissueAuthCookies(req("other=x"), res)).toBe(false);
    expect(res.cookies.getAll()).toEqual([]);
  });
  test("이번 응답이 토큰 갱신으로 이미 쓴 쿠키는 옛 값으로 덮지 않는다", () => {
    const res = NextResponse.next();
    res.cookies.set("sb-abc-auth-token", "new", { path: "/", maxAge: 100 });
    reissueAuthCookies(req("sb-abc-auth-token=old"), res);
    expect(res.cookies.get("sb-abc-auth-token")!.value).toBe("new");
    expect(res.cookies.get(REISSUE_MARK)).toBeTruthy();
  });
});

describe("이 기기에서 쓰던 계정", () => {
  test("모양이 맞을 때만 읽는다", () => {
    expect(parseLastAccount(JSON.stringify({ id: "1aa4bbd3", anonymous: false }))).toEqual({ id: "1aa4bbd3", anonymous: false });
    expect(parseLastAccount("{bad")).toBeNull();
    expect(parseLastAccount(JSON.stringify({ id: "x" }))).toBeNull();
    expect(parseLastAccount(null)).toBeNull();
  });
});
