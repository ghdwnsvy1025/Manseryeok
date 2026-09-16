/**
 * 용신일 → 운세·홈 연결 검증.
 *
 * 여기서 지켜야 할 선이 하나 있다.
 * **용신은 아직 확인 안 된 이론이다.** 기록으로 확인된 사실(verifiedDayPatterns)과
 * 같은 통에 담기면 이론이 사실 행세를 하게 된다. 층이 섞이지 않는지 고정한다.
 */
import { describe, expect, test } from "@jest/globals";
import { buildTodayYongsin } from "@/lib/hypothesis/todayYongsin";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import { buildDayFacts } from "@/lib/hypothesis/dayFacts";
import { PERSONALIZED_FORTUNE_SYSTEM_PROMPT } from "@/lib/journal/fortune/personalizedPrompt";
import type { SajuProfilePillars } from "@/lib/diary/types";

/** 사장님 사주 — 용신 甲乙寅卯 (T존에 없음) */
const OWNER: SajuProfilePillars = {
  hour: { stemHanja: "辛", branchHanja: "未", stemKo: "신", branchKo: "미", ganjiKo: "신미" },
  day: { stemHanja: "己", branchHanja: "丑", stemKo: "기", branchKo: "축", ganjiKo: "기축" },
  month: { stemHanja: "丙", branchHanja: "戌", stemKo: "병", branchKo: "술", ganjiKo: "병술" },
  year: { stemHanja: "乙", branchHanja: "亥", stemKo: "을", branchKo: "해", ganjiKo: "을해" },
};

/** 데모 사주 — 용신 癸 (T존 시간) */
const DEMO: SajuProfilePillars = {
  hour: { stemHanja: "癸", branchHanja: "未", stemKo: "계", branchKo: "미", ganjiKo: "계미" },
  day: { stemHanja: "庚", branchHanja: "辰", stemKo: "경", branchKo: "진", ganjiKo: "경진" },
  month: { stemHanja: "辛", branchHanja: "巳", stemKo: "신", branchKo: "사", ganjiKo: "신사" },
  year: { stemHanja: "庚", branchHanja: "午", stemKo: "경", branchKo: "오", ganjiKo: "경오" },
};

/** 2026-09 에서 용신일인 날짜 하나와 아닌 날짜 하나를 실제로 찾는다 */
function findDays(pillars: SajuProfilePillars): { yes: string; no: string } {
  const natal = buildNatalSummary(pillars);
  let yes = "";
  let no = "";
  for (let d = 1; d <= 30 && (!yes || !no); d += 1) {
    const date = `2026-09-${String(d).padStart(2, "0")}`;
    const hit = buildDayFacts(date, pillars, natal).isYongsin;
    if (hit && !yes) yes = date;
    if (!hit && !no) no = date;
  }
  return { yes, no };
}

describe("용신일 판정이 날짜별로 갈린다", () => {
  test("용신일에는 홈 문구와 LLM 사실이 생긴다", () => {
    const { yes } = findDays(OWNER);
    const r = buildTodayYongsin({ pillars: OWNER, date: yes })!;
    expect(r.isYongsinDay).toBe(true);
    expect(r.headline).toBe("힘을 보태 주는\n기운이 들어와요");
    expect(r.subline).toBe("나무(木) 기운이 오는 날");
    expect(r.fact).toContain("용신");
  });

  test("용신일이 아니면 문구가 전부 null 이다", () => {
    const { no } = findDays(OWNER);
    const r = buildTodayYongsin({ pillars: OWNER, date: no })!;
    expect(r.isYongsinDay).toBe(false);
    expect(r.headline).toBeNull();
    expect(r.subline).toBeNull();
    expect(r.fact).toBeNull();
  });

  test("T존에 있는 용신은 '더 직접적'이라고 말한다", () => {
    const { yes } = findDays(DEMO);
    const r = buildTodayYongsin({ pillars: DEMO, date: yes })!;
    expect(r.fromTZone).toBe(true);
    expect(r.fact).toContain("T존");
  });

  test("T존에 없으면 '밖에서 채워진다'고 말한다", () => {
    const { yes } = findDays(OWNER);
    const r = buildTodayYongsin({ pillars: OWNER, date: yes })!;
    expect(r.fromTZone).toBe(false);
    expect(r.fact).toContain("밖에서 채워지는");
  });
});

describe("빠진 값", () => {
  test("사주 프로필이 없으면 null", () => {
    expect(buildTodayYongsin({ pillars: null })).toBeNull();
    expect(buildTodayYongsin({ pillars: undefined })).toBeNull();
  });

  test("간지가 깨져도 터지지 않는다", () => {
    const broken = {
      hour: { stemHanja: "?", branchHanja: "?", stemKo: "?", branchKo: "?", ganjiKo: "?" },
      day: { stemHanja: "?", branchHanja: "?", stemKo: "?", branchKo: "?", ganjiKo: "?" },
      month: { stemHanja: "?", branchHanja: "?", stemKo: "?", branchKo: "?", ganjiKo: "?" },
      year: { stemHanja: "?", branchHanja: "?", stemKo: "?", branchKo: "?", ganjiKo: "?" },
    } as SajuProfilePillars;
    expect(() => buildTodayYongsin({ pillars: broken, date: "2026-09-15" })).not.toThrow();
  });
});

describe("층이 섞이지 않는다", () => {
  test("사용자에게 보이는 문구에는 '용신'이 없다", () => {
    // 홈 큰 제목·작은 줄은 사용자가 읽는 글이다. 전문용어를 쓰지 않는다.
    const { yes } = findDays(OWNER);
    const r = buildTodayYongsin({ pillars: OWNER, date: yes })!;
    for (const text of [r.headline, r.subline]) {
      for (const term of ["용신", "T존", "일진", "원국", "오행"]) {
        expect(`${text}`).not.toContain(term);
      }
    }
  });

  test("LLM 사실 문장에는 내부 용어를 써도 된다", () => {
    const { yes } = findDays(OWNER);
    const r = buildTodayYongsin({ pillars: OWNER, date: yes })!;
    expect(r.fact).toContain("일진");
  });

  test("프롬프트가 용신을 별도 층(1.5)으로 두고 기록에 양보한다", () => {
    const p = PERSONALIZED_FORTUNE_SYSTEM_PROMPT;
    expect(p).toContain("todayYongsin");
    // 0번(기록)이 이긴다는 지시가 반드시 있어야 한다
    expect(p).toContain("0번(verifiedDayPatterns)과 충돌하면 0번을 따른다");
    // 사용자 문장에 용신이라는 말을 쓰지 말라는 지시
    expect(p).toContain('"용신"이라는 말을 쓰지 않는다');
  });

  test("용신 사실이 verifiedDayPatterns 설명 안으로 들어가 있지 않다", () => {
    const p = PERSONALIZED_FORTUNE_SYSTEM_PROMPT;
    const zero = p.slice(p.indexOf("0. **verifiedDayPatterns"), p.indexOf("1. analysisFacts"));
    expect(zero).not.toContain("용신");
    expect(zero).not.toContain("todayYongsin");
  });
});
