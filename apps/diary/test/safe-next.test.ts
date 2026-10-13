import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";

describe("safeNext — 로그인 뒤 돌아갈 곳 검사 (B-H2 오픈 리다이렉트)", () => {
  it("앱 안 경로는 그대로", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/me?d=2026-10-01#stats")).toBe("/me?d=2026-10-01#stats");
    expect(safeNext("/write?date=2026-10-01")).toBe("/write?date=2026-10-01");
  });

  it("바깥으로 새는 형태는 전부 기본값", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/"); // `/\evil.com` — 옛 검사가 통과시키던 우회
    expect(safeNext("/\\\\evil.com")).toBe("/");
    expect(safeNext("/\\/evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("evil.com")).toBe("/");
  });

  it("문자열이 아니거나 비어 있으면 기본값, 기본값은 바꿀 수 있다", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined, "/settings")).toBe("/settings");
    expect(safeNext("", "")).toBe("");
    expect(safeNext("//evil.com", "")).toBe("");
  });
});
