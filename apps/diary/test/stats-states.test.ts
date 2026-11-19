import { describe, expect, test } from "vitest";
import { groupsOfDay, stateByGroup, stateHappiness, stateIntensity, stateSummary, stateTagTop, STATE_RATIO_MIN } from "@/lib/stats/states";

// 내 일간 己(기토): 甲·乙 = 관성, 丙·丁 = 인성, 戊·己 = 비겁, 庚·辛 = 식상, 壬·癸 = 재성
const ME = "己";
const TODAY = "2026-12-31";
const e = (date: string, stem: string, branch: string, states: Record<string, unknown> | null) => ({ entry_date: date, day_stem: stem, day_branch: branch, states: states as never });

describe("있었던 일(상태) 통계", () => {
  test("그날 온 십신 갈래: 천간과 지지 정기, 겹치면 하나", () => {
    expect(groupsOfDay({ day_stem: "경", day_branch: "술" }, ME)).toEqual(["식상", "비겁"]);   // 庚 상관, 戌(戊) 겁재
    expect(groupsOfDay({ day_stem: "임", day_branch: "자" }, ME)).toEqual(["재성"]);            // 壬 정재, 子(癸) 편재
    expect(groupsOfDay({ day_stem: "갑", day_branch: "인" }, ME)).toEqual(["관성"]);
  });

  test("최근 30일 축별 세 단계 횟수와 자주 고른 세부 낱말. 30일 밖·상태 없는 기록은 뺀다", () => {
    const rows = [
      e("2026-12-30", "경", "술", { pace: 3, money: 3, tags: ["treat"] }),
      e("2026-12-29", "신", "해", { pace: 3, money: 2, tags: ["treat", "tidy"] }),
      e("2026-12-28", "임", "자", { pace: 1 }),
      e("2026-12-27", "계", "축", null),
      e("2026-11-01", "갑", "인", { pace: 1, tags: ["deadline"] }),   // 30일 밖
    ];
    const s = stateSummary(rows, TODAY, 30);
    expect(s.find((x) => x.key === "pace")).toMatchObject({ n: 3, counts: [1, 0, 2], levels: ["여유", "보통", "바쁨"] });
    expect(s.find((x) => x.key === "money")).toMatchObject({ n: 2, counts: [0, 1, 1] });
    expect(s.find((x) => x.key === "people")).toMatchObject({ n: 0 });
    expect(stateTagTop(rows, TODAY, 30, 5)).toEqual([{ key: "treat", label: "사 줬음", axis: "money", n: 2 }, { key: "tidy", label: "정리·점검", axis: "money", n: 1 }]);
  });

  test("십신 갈래가 온 날의 상태: 표본 5 미만이면 비율 없이 횟수만, 5 이상이면 비율과 다른 날 비율", () => {
    // 재성(壬·癸)이 온 날 6번 중 5번 돈이 많이 나감, 재성이 안 온 날 5번 중 1번
    const rows = [
      ...["01", "02", "03", "04", "05"].map((d) => e(`2026-12-${d}`, "임", "오", { money: 3 })),
      e("2026-12-06", "계", "사", { money: 2 }),
      e("2026-12-07", "갑", "인", { money: 3, duty: 3 }),
      ...["08", "09", "10", "11"].map((d) => e(`2026-12-${d}`, "병", "오", { money: 1 })),
    ];
    const g = stateByGroup(rows, ME);
    expect(g.map((x) => x.group)).toEqual(["비겁", "식상", "재성", "관성", "인성"]);
    expect(STATE_RATIO_MIN).toBe(5);
    expect(g.find((x) => x.group === "재성")).toMatchObject({ axis: "money", n: 6, counts: [0, 1, 5], top: { level: 3, word: "많이 나감", count: 5, ratio: 0.83 }, otherRatio: 0.2 });
    // 관성이 온 날은 한 번뿐 → 비율 없음
    expect(g.find((x) => x.group === "관성")).toMatchObject({ axis: "duty", n: 1, top: { level: 3, word: "무거웠음", count: 1, ratio: null }, otherRatio: null });
    // 고른 날이 없는 갈래는 top이 null
    expect(g.find((x) => x.group === "식상")).toMatchObject({ n: 0, top: null });
  });
  test("있었던 일별 행복도: 양 끝 단계와 세부 낱말만, 두 번 이상이면 평균, 평균 높은 순", () => {
    const h = (date: string, states: Record<string, unknown> | null, happiness: number) => ({ ...e(date, "경", "술", states), happiness });
    const rows = stateHappiness([
      h("2026-12-01", { pace: 3, money: 3, tags: ["treat"] }, 4),
      h("2026-12-02", { pace: 3, money: 2 }, 6),
      h("2026-12-03", { pace: 1, tags: ["treat"] }, 9),
      h("2026-12-04", { pace: 1 }, 8),
      h("2026-12-05", null, 10),
    ]);
    expect(rows.map((r) => [r.label, r.n, r.avg])).toEqual([
      ["여유", 2, 8.5],
      ["사 줬음", 2, 6.5],
      ["바쁨", 2, 5],
      ["돈 많이 나감", 1, null],   // 한 번뿐이라 평균을 말하지 않는다. "돈 평소만큼"(2단계)은 줄이 없다
    ]);
    expect(stateHappiness([])).toEqual([]);
  });
  test("있었던 일 세기: 축마다 1~3 평균, 그 갈래가 온 날과 다른 날을 견준다(다섯 날씩 있어야 차이를 낸다)", () => {
    // 일간 己: 壬·癸 = 재성(돈), 庚·辛 = 식상(말). 임자일 = 재성만, 경신일 = 식상만
    const m = (date: string, stem: string, branch: string, states: Record<string, unknown>) => ({ ...e(date, stem, branch, states), dayMaster: ME });
    const rows = stateIntensity([
      ...[1, 2, 3, 4, 5].map((d) => m(`2026-12-0${d}`, "임", "자", { money: 3, pace: 2 })),
      ...[1, 2, 3, 4, 5].map((d) => m(`2026-12-1${d}`, "경", "신", { money: d <= 3 ? 1 : 2, pace: 3 })),
      m("2026-12-20", "경", "신", { express: 3 }),
    ]);
    const money = rows.find((r) => r.axis === "money")!;
    expect(money).toMatchObject({ group: "재성", all: { n: 10, mean: 2.2 }, on: { n: 5, mean: 3 }, off: { n: 5, mean: 1.4 }, diff: 1.6 });
    const pace = rows.find((r) => r.axis === "pace")!;
    expect(pace).toMatchObject({ group: null, all: { n: 10, mean: 2.5 }, on: { n: 0, mean: null }, diff: null });
    // 한 번뿐인 축은 평균은 내되 차이는 내지 않는다
    expect(rows.find((r) => r.axis === "express")).toMatchObject({ on: { n: 1, mean: 3 }, off: { n: 0, mean: null }, diff: null });
    expect(stateIntensity([]).every((r) => r.all.n === 0 && r.diff === null)).toBe(true);
  });
});
