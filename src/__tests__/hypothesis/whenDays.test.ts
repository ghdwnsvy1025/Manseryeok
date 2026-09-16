/**
 * "그 날이 언제인가" 검증
 *
 * 사장님이 "역할이 주어지는 날이 어떤 날이야?"라고 물었을 때
 * 앱이 답을 못 했다. 이 계산이 그 답이다.
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import type { SajuProfilePillars, UserBirthPillarDetail } from "@/lib/diary/types";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { generateHypotheses } from "@/lib/hypothesis/generate";
import {
  findWhenDays,
  frequencyLabel,
  shortDate,
  whenBadge,
  LOOKAHEAD_DAYS,
} from "@/lib/hypothesis/whenDays";
import { METRICS } from "@/lib/hypothesis/types";

const SAMPLE: SajuInput = {
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  gender: "male",
  options: {
    calendarType: "solar", timezone: "Asia/Seoul",
    dayChangeRule: "midnight", timeCorrection: "none",
  },
};

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

const r = calculateSaju(SAMPLE);
const pillars: SajuProfilePillars = {
  year: toDetail(r.pillars.year),
  month: toDetail(r.pillars.month),
  day: toDetail(r.pillars.day),
  hour: r.pillars.hour ? toDetail(r.pillars.hour) : null,
};
const natal = buildNatalSummary(pillars);
const rules = generateHypotheses(natal);

const FROM = "2026-09-09";

describe("날짜 찾기", () => {
  test("모든 카드가 한 달 안에 해당하는 날을 가진다", () => {
    const empty: string[] = [];
    for (const rule of rules) {
      const when = findWhenDays({ condition: rule.condition, pillars, natal, from: FROM });
      if (when.countAhead === 0) empty.push(rule.title);
    }
    // 한 달 안에 한 번도 안 오는 날이면 카드로 낼 가치가 없다
    expect(empty).toEqual([]);
  });

  test("오늘이 그 날이면 표시하고, upcoming 에는 안 넣는다", () => {
    for (const rule of rules) {
      const when = findWhenDays({ condition: rule.condition, pillars, natal, from: FROM });
      expect(when.upcoming).not.toContain(FROM);
      if (when.nextDate) expect(when.nextDate > FROM).toBe(true);
    }
  });

  test("upcoming 은 날짜 순이고 최대 6개다", () => {
    for (const rule of rules) {
      const when = findWhenDays({ condition: rule.condition, pillars, natal, from: FROM });
      expect(when.upcoming.length).toBeLessThanOrEqual(6);
      const sorted = [...when.upcoming].sort();
      expect(when.upcoming).toEqual(sorted);
    }
  });

  test("찾은 날 수가 내다본 기간을 넘지 않는다", () => {
    for (const rule of rules) {
      const when = findWhenDays({ condition: rule.condition, pillars, natal, from: FROM });
      expect(when.countAhead).toBeLessThanOrEqual(LOOKAHEAD_DAYS + 1);
    }
  });
});

describe("표시 문구", () => {
  test("날짜를 짧게 쓴다", () => {
    expect(shortDate("2026-09-13")).toBe("9/13");
    expect(shortDate("2026-10-01")).toBe("10/1");
  });

  test("오늘이면 '오늘', 아니면 다음 날짜", () => {
    expect(whenBadge({ isToday: true, nextDate: "2026-09-13", nextGanjiKo: null, countAhead: 3, upcoming: [] })).toBe("오늘");
    expect(whenBadge({ isToday: false, nextDate: "2026-09-13", nextGanjiKo: null, countAhead: 3, upcoming: [] })).toBe("9/13");
    expect(whenBadge({ isToday: false, nextDate: null, nextGanjiKo: null, countAhead: 0, upcoming: [] })).toBe("—");
  });

  test("빈도를 한마디로", () => {
    expect(frequencyLabel({ isToday: false, nextDate: null, nextGanjiKo: null, countAhead: 0, upcoming: [] })).toContain("없어요");
    expect(frequencyLabel({ isToday: true, nextDate: null, nextGanjiKo: null, countAhead: 9, upcoming: [] })).toBe("한 달에 9일");
  });
});

describe("지표별 사용자 문구", () => {
  test("모든 지표에 up/down 문구가 있고 서로 다르다", () => {
    for (const meta of Object.values(METRICS)) {
      expect(meta.up.length).toBeGreaterThan(2);
      expect(meta.down.length).toBeGreaterThan(2);
      expect(meta.up).not.toBe(meta.down);
    }
  });

  test("사주가 주어인 말을 쓰지 않는다", () => {
    // "맞았습니다"는 사주 자랑이지 사용자 이야기가 아니다
    for (const meta of Object.values(METRICS)) {
      for (const text of [meta.up, meta.down]) {
        expect(text).not.toContain("맞았");
        expect(text).not.toContain("사주");
      }
    }
  });
});

// ── 눈으로 확인 ──
describe("미리보기", () => {
  test("카드별 다음 날짜 출력", () => {
    const lines: string[] = ["", `  기준일 ${FROM} · 일간 ${natal.dayMasterKo}`, "  " + "─".repeat(58)];
    for (const rule of rules) {
      const when = findWhenDays({ condition: rule.condition, pillars, natal, from: FROM });
      lines.push(
        `  ${whenBadge(when).padStart(5)}  ${rule.title.padEnd(13)} ` +
        `${frequencyLabel(when).padEnd(12)} ${when.upcoming.map(shortDate).join(" ")}`
      );
    }
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(rules.length).toBeGreaterThan(0);
  });
});
