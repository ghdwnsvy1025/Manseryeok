import { describe, expect, test } from "@jest/globals";

/** history 페이지와 동일한 월 셀 생성 로직 (회귀용) */
function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }
  return cells;
}

describe("calendar month cells", () => {
  test("7열을 유지하고 날짜 문자열을 채운다", () => {
    const cells = buildMonthCells(2024, 7);
    expect(cells.length % 7).toBe(0);
    const dated = cells.filter((c) => c.date);
    expect(dated).toHaveLength(31);
    expect(dated[0].date).toBe("2024-07-01");
    expect(dated[30].date).toBe("2024-07-31");
  });

  test("2월 윤년/평년 일수", () => {
    expect(buildMonthCells(2024, 2).filter((c) => c.date)).toHaveLength(29);
    expect(buildMonthCells(2023, 2).filter((c) => c.date)).toHaveLength(28);
  });
});
