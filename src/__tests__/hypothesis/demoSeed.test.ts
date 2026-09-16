/**
 * 시연용 가짜 기록 생성기 — 겸 테스트
 *
 * 왜 필요한가.
 * `scripts/seed-browser.mjs` 가 요일 기준으로 값을 만들었더니, 카드 조건(십신·합충)과
 * 무관해서 전부 "영향 없었습니다"가 나왔다. 시스템은 정직하게 답한 것이고
 * 가짜 데이터가 틀린 것이었다.
 *
 * 시연에서 "맞았습니다 / 당신은 달랐습니다"를 보려면 **그날의 사주 조건에 맞춰**
 * 값을 만들어야 한다. 그 로직은 이미 `simulate.ts` 에 있고 flip.test.ts 로 검증돼 있다.
 * 여기서는 그걸 그대로 써서 JSON 으로 뽑아 놓는다.
 *
 * 쓰는 법
 *   WRITE_DEMO_SEED=1 npx jest src/__tests__/hypothesis/demoSeed
 *   → scripts/demo-seed.json 생성
 *
 * 환경변수 없이 돌리면 그냥 생성기가 제대로 도는지 검사만 한다.
 */
import { describe, expect, test } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";

import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts } from "@/lib/hypothesis/dayFacts";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import { simulateRecords, enumerateDates, type World } from "@/lib/hypothesis/simulate";
import type { DayFacts } from "@/lib/hypothesis/types";

/** shoot-flow.mjs 가 입력하는 생일과 반드시 같아야 한다 */
const DEMO_BIRTH: SajuInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  gender: "male",
  options: {
    calendarType: "solar",
    timezone: "Asia/Seoul",
    dayChangeRule: "midnight",
    timeCorrection: "none",
  },
};

const DEMO_DAYS = 30;
const WORLDS: World[] = ["truth", "inverted", "unrelated"];

function toDetail(p: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: p.stem.hanja,
    branchHanja: p.branch.hanja,
    stemKo: p.stem.ko,
    branchKo: p.branch.ko,
    ganjiKo: `${p.stem.ko}${p.branch.ko}`,
  };
}

function buildPillars(input: SajuInput): SajuProfilePillars {
  const r = calculateSaju(input);
  return {
    year: toDetail(r.pillars.year),
    month: toDetail(r.pillars.month),
    day: toDetail(r.pillars.day),
    hour: r.pillars.hour ? toDetail(r.pillars.hour) : null,
  };
}

/**
 * 오늘까지 포함한 DEMO_DAYS 일의 날짜.
 *
 * 예전엔 오늘을 일부러 비웠다. 그러면 "밤·미기록" 홈은 찍히지만
 * **"기록을 마친 뒤" 홈은 영원히 못 찍는다** — 오늘 기록이 없으니까.
 * 그래서 오늘까지 만들고, 촬영 쪽에서 마지막 하루를 뺄지 말지 고른다.
 */
function recentDates(days: number): string[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const p = (n: number) => String(n).padStart(2, "0");
  const startStr = `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`;
  return enumerateDates(startStr, days);
}

function buildDemoSeed() {
  const pillars = buildPillars(DEMO_BIRTH);
  const natal = buildNatalSummary(pillars);
  const rules = generateHypotheses(natal);
  const dates = recentDates(DEMO_DAYS);

  const factsByDate = new Map<string, DayFacts>(
    dates.map((d) => [d, buildDayFacts(d, pillars, natal)])
  );

  const worlds: Record<string, Array<{ date: string; metrics: Record<string, number> }>> = {};
  for (const world of WORLDS) {
    worlds[world] = simulateRecords({
      startDate: dates[0]!,
      days: DEMO_DAYS,
      factsByDate,
      rules,
      world,
      missRate: 0,
      seed: 424242,
    }).map((r) => ({ date: r.date, metrics: r.metrics as Record<string, number> }));
  }

  return {
    birth: DEMO_BIRTH,
    days: DEMO_DAYS,
    ruleIds: rules.map((r) => r.id),
    worlds,
  };
}

describe("시연용 시드", () => {
  test("세 세계 모두 날짜만큼 만들어지고 값이 범위 안에 있다", () => {
    const seed = buildDemoSeed();

    expect(seed.ruleIds.length).toBeGreaterThan(0);
    for (const world of WORLDS) {
      const rows = seed.worlds[world]!;
      expect(rows).toHaveLength(DEMO_DAYS);

      for (const row of rows) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const [metric, value] of Object.entries(row.metrics)) {
          const max = metric === "happiness" ? 10 : 5;
          const min = metric === "happiness" ? 0 : 1;
          expect(`${metric}=${value}`).toBe(`${metric}=${value}`);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  test("참인 세계와 반대인 세계의 값이 실제로 다르다", () => {
    const seed = buildDemoSeed();
    const truth = seed.worlds.truth!;
    const inverted = seed.worlds.inverted!;

    let different = 0;
    for (let i = 0; i < truth.length; i += 1) {
      if (JSON.stringify(truth[i]!.metrics) !== JSON.stringify(inverted[i]!.metrics)) {
        different += 1;
      }
    }
    // 신호가 반대로 심겼으니 대부분의 날이 달라야 한다
    expect(different).toBeGreaterThan(DEMO_DAYS / 2);
  });

  test("파일로 뽑기 (WRITE_DEMO_SEED=1 일 때만)", () => {
    if (process.env.WRITE_DEMO_SEED !== "1") {
      expect(true).toBe(true);
      return;
    }
    const out = path.join(process.cwd(), "scripts", "demo-seed.json");
    fs.writeFileSync(out, JSON.stringify(buildDemoSeed(), null, 2), "utf-8");
    // eslint-disable-next-line no-console
    console.log(`\n시연용 시드 생성 → ${out}\n`);
    expect(fs.existsSync(out)).toBe(true);
  });
});
