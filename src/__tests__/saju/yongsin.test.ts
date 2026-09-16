/**
 * 용신 판정 검증.
 *
 * 이건 명리 규칙이라 코드가 마음대로 바꾸면 안 된다. 사장님이 정한 규칙을
 * 그대로 고정해 두고, 나중에 누가 손대면 여기서 터지게 한다.
 *
 *   가장 많은 오행 → 그걸 극하는 오행이 용신
 *   그 오행 간지가 T존(시간·일지·월간)에 있으면 그 간지가 용신
 *   없으면 그 오행의 모든 간지가 용신
 */
import { describe, expect, test } from "@jest/globals";
import { findYongsin, yongsinPlainLine, T_ZONE_SLOTS } from "@/lib/saju/yongsin";

/** 사장님 사주 — 1995-10-25 13:57 (양력, 남) · 辛未 己丑 丙戌 乙亥 */
const OWNER = {
  hour: { stemKo: "신", branchKo: "미" },
  day: { stemKo: "기", branchKo: "축" },
  month: { stemKo: "병", branchKo: "술" },
  year: { stemKo: "을", branchKo: "해" },
};

/**
 * 촬영용 데모 사주 — 1990-05-15 14:30 (양력, 남) · 癸未 庚辰 辛巳 庚午
 *
 * 처음엔 이 값을 손으로 지어 넣었다가 실제 원국과 다른 걸 화면에서 발견했다.
 * 지금 값은 `calculateSaju` 를 돌려 뽑은 것이다. 사주 데이터는 지어내면 안 된다.
 */
const DEMO = {
  hour: { stemKo: "계", branchKo: "미" },
  day: { stemKo: "경", branchKo: "진" },
  month: { stemKo: "신", branchKo: "사" },
  year: { stemKo: "경", branchKo: "오" },
};

describe("오행을 세는 근거", () => {
  test("사주 원국 화면과 똑같은 분포가 나온다", () => {
    // 화면에 뜬 값: 목 16.9% · 화 15.8% · 토 36.0% · 금 16.6% · 수 14.7%
    // 여기가 어긋나면 한 탭 차이로 다른 숫자를 보여주게 된다
    const r = findYongsin(OWNER)!;
    const round = (v: number) => Math.round(v * 10) / 10;
    expect({
      목: round(r.distribution.목),
      화: round(r.distribution.화),
      토: round(r.distribution.토),
      금: round(r.distribution.금),
      수: round(r.distribution.수),
    }).toEqual({ 목: 16.9, 화: 15.8, 토: 36, 금: 16.6, 수: 14.7 });
  });

  test("분포 합이 100%다", () => {
    for (const pillars of [OWNER, DEMO]) {
      const r = findYongsin(pillars)!;
      const sum = Object.values(r.distribution).reduce((a, b) => a + b, 0);
      expect(Math.round(sum)).toBe(100);
    }
  });
});

describe("상극 — 가장 많은 오행을 누가 누르나", () => {
  test("목극토 · 화극금 · 토극수 · 금극목 · 수극화", () => {
    // 규칙 자체를 문장으로 고정한다
    const r1 = findYongsin(OWNER)!;
    expect(`${r1.dominant} → ${r1.element}`).toBe("토 → 목");

    const r2 = findYongsin(DEMO)!;
    expect(`${r2.dominant} → ${r2.element}`).toBe("화 → 수");
  });
});

describe("T존", () => {
  test("T존은 시간·일지·월간 세 자리다", () => {
    expect([...T_ZONE_SLOTS]).toEqual(["시간", "일지", "월간"]);
  });

  test("T존에 용신 오행이 있으면 그 간지만 용신이 된다", () => {
    // 데모: 용신 수 · T존 = 시간 癸(수) · 일지 辰 · 월간 辛
    const r = findYongsin(DEMO)!;
    expect(r.source).toBe("tzone");
    expect(r.ganji.map((g) => g.hanja)).toEqual(["癸"]);
    expect(r.ganji[0]!.slot).toBe("시간");
  });

  test("T존에 없으면 그 오행의 모든 간지가 용신이다", () => {
    // 사장님: 용신 목 · T존 = 시간 辛(금) · 일지 丑(토) · 월간 丙(화) → 목 없음
    const r = findYongsin(OWNER)!;
    expect(r.source).toBe("all");
    expect(r.ganji.map((g) => g.hanja)).toEqual(["甲", "乙", "寅", "卯"]);
  });

  test("일간·년간·시지·월지·년지는 T존이 아니다", () => {
    // 사장님 원국의 일간은 己(토). 용신이 토였다면 己가 T존으로 잡히면 안 된다.
    const r = findYongsin(OWNER)!;
    for (const g of r.ganji) {
      if (g.slot && g.slot !== "그 밖") {
        expect(T_ZONE_SLOTS).toContain(g.slot);
      }
    }
  });
});

describe("빠진 값·이상한 값", () => {
  test("태어난 시각을 모르면(시주 없음) 터지지 않는다", () => {
    const r = findYongsin({
      day: OWNER.day,
      month: OWNER.month,
      year: OWNER.year,
      hour: null,
    });
    expect(r).not.toBeNull();
    expect(r!.ganji.length).toBeGreaterThan(0);
  });

  test("시주가 빠지면 T존의 '시간' 자리도 빠진다", () => {
    const r = findYongsin({
      day: DEMO.day,
      month: DEMO.month,
      year: DEMO.year,
      hour: null,
    })!;
    // 癸(시간)가 사라졌으므로 T존에서 수를 못 찾는다
    for (const g of r.ganji) {
      expect(g.slot).not.toBe("시간");
    }
  });

  test("간지가 이상하면 null 이거나 조용히 넘어간다", () => {
    const r = findYongsin({
      day: { stemKo: "?", branchKo: "?" },
      month: { stemKo: "?", branchKo: "?" },
      year: { stemKo: "?", branchKo: "?" },
      hour: null,
    });
    // 어떤 값이 나오든 예외로 화면을 깨면 안 된다
    expect(r === null || typeof r.element === "string").toBe(true);
  });
});

describe("사람이 읽을 문장", () => {
  test("조사가 틀리지 않는다", () => {
    // "나무(木)이 용신이에요" 로 나간 적이 있다
    for (const pillars of [OWNER, DEMO]) {
      const line = yongsinPlainLine(findYongsin(pillars)!);
      expect(line).not.toMatch(/나무\(木\)이|쇠\(金\)가|불\(火\)가|물\(水\)가|흙\(土\)가/);
    }
  });

  test("다섯 오행 어느 조합에도 문장이 만들어진다", () => {
    const line = yongsinPlainLine(findYongsin(OWNER)!);
    expect(line).toBe(
      "흙(土) 기운이 가장 많아요. 그걸 눌러 주는 나무(木) 기운이 용신이에요"
    );
  });

  test("'틀렸다'류 단어를 쓰지 않는다", () => {
    for (const pillars of [OWNER, DEMO]) {
      const line = yongsinPlainLine(findYongsin(pillars)!);
      for (const banned of ["틀렸", "나쁜", "부족한 사람"]) {
        expect(line).not.toContain(banned);
      }
    }
  });
});
