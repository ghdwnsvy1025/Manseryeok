import { describe, expect, test } from "vitest";
import { MOOD_PICK, MOODS, STATE_AXES, canonicalMood, isPickMood, stateCount, stateSay, stateWords, validateEntry } from "@/lib/entry";

const TODAY = "2026-10-04";
const base = { entryDate: TODAY, happiness: "7", moods: [] as unknown, note: "" as unknown };

describe("validateEntry", () => {
  test("행복도만 있어도 저장된다", () => {
    const r = validateEntry(base, TODAY);
    expect(r).toEqual({ ok: true, value: { entryDate: TODAY, happiness: 7, moods: [], note: null, areas: null, states: null, tomorrowNote: null } });
  });

  test("영역 점수(1~5)는 선택, 하루 행복도는 직접 매긴 값 그대로 (2026-11-01: 영역 평균으로 덮지 않는다)", () => {
    const r = validateEntry({ ...base, happiness: "6", areas: { work: "4", money: "", health: "5", love: null } }, TODAY);
    expect(r).toMatchObject({ ok: true, value: { happiness: 6, areas: { work: 4, health: 5 } } });
    expect(validateEntry({ ...base, happiness: "10", areas: { family: "1" } }, TODAY)).toMatchObject({ ok: true, value: { happiness: 10 } });
    expect(validateEntry({ ...base, areas: { work: "6" } }, TODAY).ok).toBe(false);
    expect(validateEntry({ ...base, areas: { pet: "3" } }, TODAY).ok).toBe(false);
  });

  test("행복도가 없으면 영역을 매겨도 막는다", () => {
    expect(validateEntry({ ...base, happiness: "", areas: { work: "" } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining("행복도") });
    expect(validateEntry({ ...base, happiness: "", areas: { work: "4" } }, TODAY)).toMatchObject({ ok: false, error: expect.stringContaining("행복도") });
  });

  test("오늘 있었던 일(상태): 축은 1~3, 고른 것만, 세부 낱말은 목록 안에서만. 없으면 null", () => {
    expect(validateEntry(base, TODAY)).toMatchObject({ ok: true, value: { states: null } });
    expect(validateEntry({ ...base, states: { pace: "", money: null, tags: [] } }, TODAY)).toMatchObject({ ok: true, value: { states: null } });
    expect(validateEntry({ ...base, states: { pace: "3", money: "3", people: "", tags: ["treat", "treat", "fight"] } }, TODAY)).toMatchObject({ ok: true, value: { states: { pace: 3, money: 3, tags: ["treat", "fight"] } } });
    expect(validateEntry({ ...base, states: { tags: "treat" } }, TODAY)).toMatchObject({ ok: true, value: { states: { tags: ["treat"] } } });
    for (const bad of [{ pace: "0" }, { pace: "4" }, { pace: "2.5" }, { weather: "2" }, { tags: ["nope"] }]) expect(validateEntry({ ...base, states: bad }, TODAY).ok, JSON.stringify(bad)).toBe(false);
  });

  test("상태 낱말: 보통은 빼고, 속도는 말만, 갈래는 이름을 붙이고, 세부 낱말이 뒤에", () => {
    expect(stateWords({ pace: 3, money: 3, people: 2, mind: 1, tags: ["treat"] })).toEqual(["바쁨", "돈 많이 나감", "머리 비움", "사 줬음"]);
    expect(stateWords({ people: 3, express: 3, mind: 3, duty: 1 })).toEqual(["사람과 마찰", "말 많이 함", "책임 가벼움", "생각 많음"]);   // 축 이름과 단계 말이 겹치지 않는다
    expect(stateSay("money", 2)).toBe("돈 평소만큼");
    expect(stateSay("pace", 2)).toBe("속도 보통");
    expect(stateWords(null)).toEqual([]);
    expect(stateCount({ pace: 2, tags: ["treat"] })).toBe(1);
    expect(STATE_AXES.filter((a) => a.group).map((a) => a.group)).toEqual(["비겁", "식상", "재성", "관성", "인성"]);
  });

  test("기분 고르기 네 갈래: 이름은 예전 목록 안에 있고, 예전 기분은 한 이름으로 묶인다", () => {
    const names = MOOD_PICK.flatMap((g) => g.moods.map((m) => m.name));
    expect(names).toHaveLength(21);
    expect(new Set(names).size).toBe(21);
    for (const n of names) expect(MOODS as readonly string[], n).toContain(n);
    for (const g of MOOD_PICK) for (const m of g.moods) for (const x of m.merges) { expect(MOODS as readonly string[], x).toContain(x); expect(canonicalMood(x)).toBe(m.name); expect(isPickMood(x)).toBe(false); }
    expect(canonicalMood("행복함")).toBe("기쁨");
    expect(canonicalMood("바쁨")).toBe("바쁨");   // 상태로 옮긴 말은 묶지 않는다
    expect(isPickMood("기쁨")).toBe(true);
    // 묶이지 않고 고르기에도 없는 예전 기분은 셋뿐
    expect((MOODS as readonly string[]).filter((m) => canonicalMood(m) === m && !isPickMood(m))).toEqual(["바쁨", "생각 많음", "아픔"]);
  });

  test("내일의 나에게 쪽지는 100자까지, 앞뒤 공백 지움", () => {
    expect(validateEntry({ ...base, tomorrowNote: "  내일은 일찍 자자 " }, TODAY)).toMatchObject({ ok: true, value: { tomorrowNote: "내일은 일찍 자자" } });
    expect(validateEntry({ ...base, tomorrowNote: "가".repeat(101) }, TODAY).ok).toBe(false);
  });

  test("약속을 안 보내면(undefined) 값에 약속이 없다 — 저장할 때 지난 값을 건드리지 않는다", () => {
    const r = validateEntry(base, TODAY);
    expect(r.ok && "promise" in r.value).toBe(false);
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

  test("기분은 목록 안에서 개수 제한 없이, 중복은 하나로", () => {
    expect(validateEntry({ ...base, moods: ["기쁨", "평온", "설렘", "불안", "멍함", "아픔"] }, TODAY).ok).toBe(true);
    expect(validateEntry({ ...base, moods: ["행복"] }, TODAY).ok).toBe(false);
    expect(validateEntry({ ...base, moods: ["행복함"] }, TODAY).ok).toBe(true);
    const r = validateEntry({ ...base, moods: ["기쁨", "기쁨"] }, TODAY);
    expect(r.ok && r.value.moods).toEqual(["기쁨"]);
  });

  test("메모는 앞뒤 공백을 지우고 500자까지", () => {
    const r = validateEntry({ ...base, note: "  산책했다  " }, TODAY);
    expect(r.ok && r.value.note).toBe("산책했다");
    expect(validateEntry({ ...base, note: "가".repeat(501) }, TODAY).ok).toBe(false);
  });
});
