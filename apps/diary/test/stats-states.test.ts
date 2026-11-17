import { describe, expect, test } from "vitest";
import { groupsOfDay, stateByGroup, stateSummary, stateTagTop, STATE_RATIO_MIN } from "@/lib/stats/states";

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
});
