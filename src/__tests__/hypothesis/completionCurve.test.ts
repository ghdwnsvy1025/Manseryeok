/**
 * 운세 맞춤도 곡선 — 며칠째에 몇 %가 되는가
 *
 * 이 숫자는 사용자가 매일 보는 값이고, 60일 마일스톤(유료 리포트)의 근거다.
 * 너무 빨리 차면 60일까지 갈 이유가 없어지고,
 * 너무 느리면 초반에 포기한다. 그래서 곡선을 테스트로 고정한다.
 *
 * 실제 사주·실제 시뮬레이션 기록으로 잰다. 손으로 만든 숫자가 아니다.
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { evaluateAll } from "@/lib/hypothesis/evaluate";
import { simulateRecords, enumerateDates } from "@/lib/hypothesis/simulate";
import { computeCompletion } from "@/lib/hypothesis/completion";
import { MOOD_OPTIONS } from "@/lib/journal/types";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { DayFacts } from "@/lib/hypothesis/types";

const SAMPLE: SajuInput = {
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  gender: "male",
  options: {
    calendarType: "solar", timezone: "Asia/Seoul",
    dayChangeRule: "midnight", timeCorrection: "none",
  },
};

const START = "2026-01-01";
const MAX_DAYS = 200;

function toDetail(p: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: p.stem.hanja, branchHanja: p.branch.hanja,
    stemKo: p.stem.ko, branchKo: p.branch.ko,
    ganjiKo: `${p.stem.ko}${p.branch.ko}`,
  };
}

const result = calculateSaju(SAMPLE);
const pillars: SajuProfilePillars = {
  year: toDetail(result.pillars.year),
  month: toDetail(result.pillars.month),
  day: toDetail(result.pillars.day),
  hour: result.pillars.hour ? toDetail(result.pillars.hour) : null,
};
const natal = buildNatalSummary(pillars);
const rules = generateHypotheses(natal);
const allDates = enumerateDates(START, MAX_DAYS);
const factsByDate = new Map<string, DayFacts>(
  allDates.map((d) => [d, buildDayFacts(d, pillars, natal)])
);
const allRecords = simulateRecords({
  startDate: START, days: MAX_DAYS, factsByDate,
  rules, world: "truth", missRate: 0, seed: 909090,
});

/** n일째 기록했을 때의 맞춤도 */
function percentAt(n: number) {
  const records = allRecords.slice(0, n);
  const dates = records.map((r) => r.date);

  const ganji = new Set<number>();
  for (const d of dates) {
    try { ganji.add(getPillarsForDate(d).dayPillar.ganjiIndex); } catch { /* skip */ }
  }
  const weekdays = new Set<number>();
  for (const d of dates) weekdays.add(new Date(`${d}T00:00:00Z`).getUTCDay());

  // 기분은 현실적으로 절반 정도만 골고루 쓴다고 본다
  const moodVariety = Math.min(MOOD_OPTIONS.length, Math.ceil(n / 3));

  const cards = evaluateAll(rules, records, factsByDate);
  const c = computeCompletion({
    recordedDays: dates.length,
    cards,
    collectedGanji: ganji.size,
    weekdayCoverage: weekdays.size,
    moodVariety,
    moodTotal: MOOD_OPTIONS.length,
    recordDates: dates,
  });
  return {
    percent: c.percent,
    settled: cards.filter((x) => x.status !== "collecting").length,
    total: cards.length,
    axes: c.axes,
  };
}

describe("맞춤도 곡선", () => {
  test("며칠째에 몇 %인지 출력", () => {
    const marks = [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 150, 200];
    const lines: string[] = ["", "  일수   맞춤도   확인된 성향   축별(기록/성향/간지/다양성)"];
    lines.push("  " + "─".repeat(62));
    for (const n of marks) {
      const r = percentAt(n);
      const axes = r.axes.map((a) => String(Math.round(a.ratio * 100)).padStart(3)).join(" ");
      lines.push(
        `  ${String(n).padStart(4)}일  ${String(r.percent).padStart(4)}%   ` +
        `${String(r.settled).padStart(2)}/${r.total}       ${axes}`
      );
    }
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(marks.length).toBeGreaterThan(0);
  });

  test("목표 구간 안에 들어온다", () => {
    // 왜 이 구간인가
    //  7일  — 첫 주에 "움직이긴 하네" 정도. 너무 높으면 성취가 싸구려가 된다
    //  30일 — 절반 못 미치게. 아직 갈 길이 있다고 느껴야 60일까지 간다
    //  60일 — 유료 리포트 여는 지점. "거의 다 왔다"지만 100은 아니다
    // 100일 — 사실상 완성. 여기서 100을 주면 그 뒤가 허무하다
    const bands: Array<[number, number, number]> = [
      [7, 4, 15],
      [30, 33, 52],
      [60, 62, 80],
      [100, 80, 93],
    ];

    const failures: string[] = [];
    for (const [day, lo, hi] of bands) {
      const p = percentAt(day).percent;
      if (p < lo || p > hi) failures.push(`${day}일: ${p}% (목표 ${lo}~${hi}%)`);
    }
    expect(failures).toEqual([]);
  });

  test("절대 줄지 않고, 60일에 100%가 되지 않는다", () => {
    let prev = -1;
    for (const n of [1, 7, 14, 30, 45, 60, 90, 120]) {
      const p = percentAt(n).percent;
      expect(`${n}일 ${p}% >= 이전 ${prev}%`).toBe(`${n}일 ${p}% >= 이전 ${prev}%`);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(percentAt(60).percent).toBeLessThan(100);
  });

  test("충분히 오래 쓰면 100%에 도달한다", () => {
    expect(percentAt(200).percent).toBeGreaterThanOrEqual(97);
  });
});
