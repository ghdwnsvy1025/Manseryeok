/**
 * 만세력 공통 회귀 케이스 — 사주 코어·바이럴과 같은 표(test/fixtures/shared-cases.json)를 돌린다.
 * known.engine이 있는 케이스는 엔진이 정답과 다르게 내는 알려진 차이다. 고쳐서 정답이 나오면 known을 지운다.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { calculateSaju } from "../src/calculator";

type Expect = { solar?: string; year?: string; month?: string; day?: string; hour?: string | null; error?: boolean };
type Case = {
  id: string;
  input: { calendar: "solar" | "lunar"; year: number; month: number; day: number; isLeap?: boolean; hour?: number; minute?: number };
  expect: Expect;
  known?: { engine?: Expect; viral?: Expect };
};

const table = JSON.parse(readFileSync(new URL("./fixtures/shared-cases.json", import.meta.url), "utf8")) as { cases: Case[] };

function run(c: Case): Expect {
  const { input } = c;
  try {
    const r = calculateSaju({
      year: input.year,
      month: input.month,
      day: input.day,
      ...(input.hour === undefined ? {} : { hour: input.hour, minute: input.minute ?? 0 }),
      gender: "male",
      options: {
        calendarType: input.calendar,
        isLeapMonth: input.isLeap ?? false,
        timezone: "Asia/Seoul",
        dayChangeRule: "midnight",
        timeCorrection: "none",
      },
    });
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      solar: r.input.lunarConversion?.outputSolar ?? `${input.year}-${pad(input.month)}-${pad(input.day)}`,
      year: r.pillars.year.ganji,
      month: r.pillars.month.ganji,
      day: r.pillars.day.ganji,
      hour: r.pillars.hour?.ganji ?? null,
    };
  } catch {
    return { error: true };
  }
}

describe("만세력 공통 회귀 케이스", () => {
  test.each(table.cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const want: Expect = c.known?.engine?.error ? { error: true } : { ...c.expect, ...c.known?.engine };
    if (want.error) {
      expect(run(c)).toEqual({ error: true });
    } else {
      expect(run(c)).toEqual(want);
    }
  });
});
