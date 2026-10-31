// 2026-10-31 나 탭 개편: 영역별 평균, 가장 행복한 날·힘든 날, 그래프 빈 날 잇기
import { describe, expect, test } from "vitest";
import { areaAverages, areaTo10, bestWorstDays, happinessSeries, type StatEntry } from "@/lib/stats/extra";
import { bridgedPaths } from "@/components/HappinessChart";

const e = (entry_date: string, happiness: number, areas: StatEntry["areas"] = null, moods: string[] = []): StatEntry => ({ entry_date, happiness, areas, moods });

describe("영역별 평균 (최근 30일)", () => {
  test("매긴 날만 평균, 영역 순서는 고정, 30일 밖은 뺀다", () => {
    const rows = [e("2026-10-31", 8, { work: 4, love: 5 }), e("2026-10-30", 6, { work: 2 }), e("2026-09-01", 2, { work: 1 }), e("2026-10-29", 7)];
    const avg = areaAverages(rows, "2026-10-31");
    expect(avg.map((a) => a.key)).toEqual(["work", "money", "health", "family", "love", "people"]);
    expect(avg[0]).toMatchObject({ mean: 3, n: 2 });
    expect(avg[4]).toMatchObject({ mean: 5, n: 1 });
    expect(avg[1]).toMatchObject({ mean: null, n: 0 });
  });
});

describe("가장 행복한 날·힘든 날", () => {
  test("같은 점수면 최근 날, 달로 거른다", () => {
    const rows = [e("2026-10-03", 9), e("2026-10-20", 9), e("2026-10-10", 2), e("2026-10-25", 2), e("2026-09-15", 10)];
    expect(bestWorstDays(rows, "2026-10")).toMatchObject({ best: { date: "2026-10-20" }, worst: { date: "2026-10-25" } });
    expect(bestWorstDays(rows).best).toMatchObject({ date: "2026-09-15", happiness: 10 });
  });
  test("기록이 하나뿐이거나 모두 같은 점수면 힘든 날은 없다", () => {
    expect(bestWorstDays([e("2026-10-01", 5)]).worst).toBeNull();
    expect(bestWorstDays([e("2026-10-01", 5), e("2026-10-02", 5)])).toMatchObject({ best: { date: "2026-10-02" }, worst: null });
    expect(bestWorstDays([], "2026-10")).toEqual({ best: null, worst: null });
  });
});

describe("그래프: 기록 없는 날을 건너 잇기", () => {
  test("이웃한 날은 solid, 빈 날을 건너는 구간은 gap", () => {
    const p = bridgedPaths([5, 6, null, null, 7, null]);
    expect(p.solid.match(/L/g)).toHaveLength(1);
    expect(p.gap.match(/L/g)).toHaveLength(1);
    expect(bridgedPaths([null, 5, null]).gap).toBe("");
  });
  test("시리즈에 그날 영역이 실린다, 영역 단계는 하루 행복도와 같은 척도", () => {
    const s = happinessSeries([e("2026-10-31", 8, { work: 4 })], [], "2026-10-31", 2);
    expect(s[1]!.areas).toEqual({ work: 4 });
    expect(s[0]!.areas).toBeNull();
    expect(areaTo10(4)).toBe(s[1]!.happiness10);
  });
});
