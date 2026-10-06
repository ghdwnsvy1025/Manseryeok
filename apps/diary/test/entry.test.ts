import { describe, expect, test } from "vitest";
import { validateEntry } from "@/lib/entry";

const TODAY = "2026-10-04";
const base = { entryDate: TODAY, happiness: "7", moods: [] as unknown, note: "" as unknown };

describe("validateEntry", () => {
  test("행복도만 있어도 저장된다", () => {
    const r = validateEntry(base, TODAY);
    expect(r).toEqual({ ok: true, value: { entryDate: TODAY, happiness: 7, moods: [], note: null, promise: null, promiseText: null } });
  });

  test("오늘의 작은 약속: 없거나 빈 값이면 null, kept/missed/na만 받고 문장은 상태가 있을 때만 남긴다", () => {
    expect(validateEntry({ ...base, promise: "", promiseText: "x" }, TODAY)).toMatchObject({ ok: true, value: { promise: null, promiseText: null } });
    expect(validateEntry({ ...base, promise: null, promiseText: null }, TODAY)).toMatchObject({ ok: true, value: { promise: null } });
    for (const p of ["kept", "missed", "na"]) {
      expect(validateEntry({ ...base, promise: p, promiseText: " 저녁에 지출을 확인해요 " }, TODAY)).toMatchObject({
        ok: true,
        value: { promise: p, promiseText: "저녁에 지출을 확인해요" },
      });
    }
    expect(validateEntry({ ...base, promise: "kept", promiseText: "" }, TODAY)).toMatchObject({ ok: true, value: { promise: "kept", promiseText: null } });
    const bad = validateEntry({ ...base, promise: "yes" }, TODAY);
    expect(bad.ok).toBe(false);
    expect(bad).toMatchObject({ error: expect.stringContaining("약속") });
  });

  test("행복도는 1~10 정수", () => {
    for (const h of ["0", "11", "7.5", "", "abc"]) {
      expect(validateEntry({ ...base, happiness: h }, TODAY).ok).toBe(false);
    }
    expect(validateEntry({ ...base, happiness: "1" }, TODAY).ok).toBe(true);
    expect(validateEntry({ ...base, happiness: "10" }, TODAY).ok).toBe(true);
  });

  test("미래 날짜와 없는 날짜는 거부", () => {
    expect(validateEntry({ ...base, entryDate: "2026-10-05" }, TODAY).ok).toBe(false);
    expect(validateEntry({ ...base, entryDate: "2026-02-30" }, TODAY).ok).toBe(false);
    expect(validateEntry({ ...base, entryDate: "2026-10-03" }, TODAY).ok).toBe(true);
  });

  test("기분은 목록 안에서 3개까지, 중복은 하나로", () => {
    expect(validateEntry({ ...base, moods: ["기쁨", "평온", "설렘"] }, TODAY).ok).toBe(true);
    expect(validateEntry({ ...base, moods: ["기쁨", "평온", "설렘", "불안"] }, TODAY).ok).toBe(false);
    expect(validateEntry({ ...base, moods: ["행복"] }, TODAY).ok).toBe(false);
    const r = validateEntry({ ...base, moods: ["기쁨", "기쁨"] }, TODAY);
    expect(r.ok && r.value.moods).toEqual(["기쁨"]);
  });

  test("메모는 앞뒤 공백을 지우고 500자까지", () => {
    const r = validateEntry({ ...base, note: "  산책했다  " }, TODAY);
    expect(r.ok && r.value.note).toBe("산책했다");
    expect(validateEntry({ ...base, note: "가".repeat(501) }, TODAY).ok).toBe(false);
  });
});
