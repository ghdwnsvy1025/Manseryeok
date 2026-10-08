// 쓰기 화면 날짜 앞뒤 이동 (B7): 어제로는 2020-01-01까지, 내일로는 오늘까지
import { describe, expect, test } from "vitest";
import { resolveWriteDate, writeDateLinks } from "@/lib/writeNav";

describe("writeDateLinks", () => {
  test("과거 날짜면 어제·내일 둘 다", () => {
    expect(writeDateLinks("2026-10-07", "2026-10-08")).toEqual({ prev: "/write?date=2026-10-06", next: "/write?date=2026-10-08" });
  });

  test("오늘이면 내일 링크가 없다", () => {
    expect(writeDateLinks("2026-10-08", "2026-10-08")).toEqual({ prev: "/write?date=2026-10-07", next: null });
  });

  test("월·연 경계를 넘는다", () => {
    expect(writeDateLinks("2026-01-01", "2026-10-08").prev).toBe("/write?date=2025-12-31");
    expect(writeDateLinks("2026-02-28", "2026-10-08").next).toBe("/write?date=2026-03-01");
  });

  test("가장 이른 날(2020-01-01)이면 어제 링크가 없다", () => {
    expect(writeDateLinks("2020-01-01", "2026-10-08")).toEqual({ prev: null, next: "/write?date=2020-01-02" });
    expect(writeDateLinks("2020-01-02", "2026-10-08").prev).toBe("/write?date=2020-01-01");
  });

  test("잘못된 날짜면 둘 다 없다", () => {
    expect(writeDateLinks("2026-02-30", "2026-10-08")).toEqual({ prev: null, next: null });
    expect(writeDateLinks("abc", "2026-10-08")).toEqual({ prev: null, next: null });
  });
});

describe("resolveWriteDate", () => {
  const TODAY = "2026-10-08";
  test("없거나 과거·오늘이면 그대로 (adjusted=false)", () => {
    expect(resolveWriteDate(undefined, TODAY)).toEqual({ date: TODAY, adjusted: false });
    expect(resolveWriteDate("", TODAY)).toEqual({ date: TODAY, adjusted: false });
    expect(resolveWriteDate("2026-10-07", TODAY)).toEqual({ date: "2026-10-07", adjusted: false });
    expect(resolveWriteDate(TODAY, TODAY)).toEqual({ date: TODAY, adjusted: false });
  });

  test("미래면 오늘로 바꾸고 adjusted=true", () => {
    expect(resolveWriteDate("2026-10-09", TODAY)).toEqual({ date: TODAY, adjusted: true });
    expect(resolveWriteDate("2027-01-01", TODAY)).toEqual({ date: TODAY, adjusted: true });
  });

  test("잘못된 날짜·2020년 이전도 오늘로 (adjusted=true)", () => {
    expect(resolveWriteDate("2026-02-30", TODAY)).toEqual({ date: TODAY, adjusted: true });
    expect(resolveWriteDate("abc", TODAY)).toEqual({ date: TODAY, adjusted: true });
    expect(resolveWriteDate("2019-12-31", TODAY)).toEqual({ date: TODAY, adjusted: true });
  });
});
