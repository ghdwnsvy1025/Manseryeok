import { describe, expect, test } from "vitest";
import { forecastVersus, happyWhen, GROUP_MIN_DAYS } from "@/lib/stats/insight";

// 내 일간 己(기토): 甲·乙 = 관성, 丙·丁 = 인성, 戊·己 = 비겁, 庚·辛 = 식상, 壬·癸 = 재성
const ME = "己";
const e = (date: string, stem: string, branch: string, happiness: number) => ({ entry_date: date, day_stem: stem, day_branch: branch, happiness });

describe("나 탭 물음 인장의 답", () => {
  test("나는 언제 행복했지: 갈래별 평균, 3일 이상이고 전체 평균보다 높은 갈래 하나를 한 문장으로", () => {
    const rows = [
      e("2026-12-01", "경", "신", 9), e("2026-12-02", "신", "유", 8), e("2026-12-03", "경", "신", 9),   // 식상 3일 평균 8.7
      e("2026-12-04", "임", "자", 4), e("2026-12-05", "계", "해", 5), e("2026-12-06", "임", "자", 3),   // 재성 3일 평균 4
      e("2026-12-07", "갑", "인", 10),                                                                  // 관성 1일 — 말하지 않는다
    ];
    const r = happyWhen(rows, ME);
    expect(r.top).toMatchObject({ group: "식상", n: 3, avg: 8.7 });
    expect(r.sentence).toBe("표현하는 기운이 들어온 날에 가장 행복했어요");
    expect(r.rows.find((x) => x.group === "관성")).toMatchObject({ n: 1, avg: 10 });
    expect(r.rows.findIndex((x) => x.group === "관성")).toBeGreaterThan(r.rows.findIndex((x) => x.group === "재성"));   // 표본 모자란 갈래는 뒤
    expect(GROUP_MIN_DAYS).toBe(3);
  });

  test("나는 언제 행복했지: 말할 갈래가 없으면 문장 없음", () => {
    expect(happyWhen([e("2026-12-01", "경", "신", 9)], ME)).toMatchObject({ top: null, sentence: null, overall: 9 });
    expect(happyWhen([], ME)).toMatchObject({ top: null, sentence: null, overall: null });
    // 모든 날이 같은 점수면 전체 평균보다 높은 갈래가 없다
    const flat = [e("2026-12-01", "경", "신", 6), e("2026-12-02", "경", "신", 6), e("2026-12-03", "경", "신", 6)];
    expect(happyWhen(flat, ME).sentence).toBeNull();
  });

  test("예상은 맞았을까: 좋음·주의로 본 날만 기록과 견준다. 날 수로만, 안 맞은 날도 적는다", () => {
    const entries = [e("2026-12-01", "경", "신", 8), e("2026-12-02", "경", "신", 9), e("2026-12-03", "경", "신", 3), e("2026-12-04", "경", "신", 2), e("2026-12-05", "경", "신", 8), e("2026-12-06", "경", "신", 5)];
    const fortunes = [
      { fortune_date: "2026-12-01", score: 7.1 }, { fortune_date: "2026-12-02", score: 6.8 }, { fortune_date: "2026-12-03", score: 7.5 },   // 좋음 3: 좋았음 2, 힘듦 1
      { fortune_date: "2026-12-04", score: 3.0 }, { fortune_date: "2026-12-05", score: 4.7 },                                              // 주의 2: 힘듦 1, 좋았음 1
      { fortune_date: "2026-12-06", score: 5.5 },                                                                                          // 무난 — 안 센다
      { fortune_date: "2026-12-07", score: 8.0 },                                                                                          // 기록 없음 — 안 센다
    ];
    const r = forecastVersus(entries, fortunes);
    expect(r.good).toEqual({ days: 3, good: 2, hard: 1 });
    expect(r.caution).toEqual({ days: 2, hard: 1, good: 1 });
    expect(r.sentences).toEqual(["좋을 날로 본 3일 중 2일이 실제로 좋았어요. 1일은 힘들었어요", "조심할 날로 본 2일 중 1일이 실제로 힘들었어요. 1일은 오히려 좋았어요"]);
    expect(r.days.map((d) => d.date)).toEqual(["2026-12-05", "2026-12-04", "2026-12-03", "2026-12-02", "2026-12-01"]);
    expect(r.days[0]).toMatchObject({ band: "주의", happiness: 8, hit: false });
    expect(r.sentences.join("")).not.toMatch(/%/);
  });

  test("0.5 미만 차이로는 단정하지 않는다 / 0일은 '없었어요'로 말한다", () => {
    // 식상 3일 평균 7, 재성 3일 평균 6.7 → 전체 6.8, 차이 0.2
    const close = [e("2026-12-01", "경", "신", 7), e("2026-12-02", "경", "신", 7), e("2026-12-03", "경", "신", 7), e("2026-12-04", "임", "자", 7), e("2026-12-05", "임", "자", 7), e("2026-12-06", "임", "자", 6)];
    expect(happyWhen(close, ME).sentence).toBeNull();
    const r = forecastVersus([e("2026-12-01", "경", "신", 8), e("2026-12-02", "경", "신", 5)], [{ fortune_date: "2026-12-01", score: 3 }, { fortune_date: "2026-12-02", score: 8 }]);
    expect(r.sentences).toEqual(["좋을 날로 본 1일 중 실제로 좋았던 날은 없었어요", "조심할 날로 본 1일 중 실제로 힘들었던 날은 없었어요. 1일은 오히려 좋았어요"]);
  });

  test("예상은 맞았을까: 견줄 날이 없으면 문장 없음", () => {
    expect(forecastVersus([], [{ fortune_date: "2026-12-01", score: 8 }])).toMatchObject({ sentences: [], days: [] });
  });
});
