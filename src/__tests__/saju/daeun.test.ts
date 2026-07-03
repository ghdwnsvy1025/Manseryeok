import {
  calculateDaeun,
  calculateDaeunStartAge,
  findTargetTermForDaeun,
  getDaeunDirection,
  getDaeunGanjiList,
  type SolarTerm,
} from "@/lib/saju/daeun";

const solarTerms: SolarTerm[] = [
  { nameKo: "소한", nameHanja: "小寒", datetime: "1999-01-06T00:00:00+09:00" },
  { nameKo: "대한", nameHanja: "大寒", datetime: "1999-01-20T00:00:00+09:00" },
  { nameKo: "입춘", nameHanja: "立春", datetime: "1999-02-04T00:00:00+09:00" },
  { nameKo: "경칩", nameHanja: "驚蟄", datetime: "1999-03-06T00:00:00+09:00" },
  { nameKo: "청명", nameHanja: "清明", datetime: "1999-04-05T00:00:00+09:00" },
];

describe("getDaeunDirection", () => {
  test("양남음녀는 순행, 음남양녀는 역행", () => {
    expect(getDaeunDirection("甲", "male")).toBe("forward");
    expect(getDaeunDirection("乙", "female")).toBe("forward");
    expect(getDaeunDirection("乙", "male")).toBe("backward");
    expect(getDaeunDirection("甲", "female")).toBe("backward");
  });

  test("올바르지 않은 년간은 오류", () => {
    expect(() => getDaeunDirection("A", "male")).toThrow("Invalid year stem");
  });
});

describe("getDaeunGanjiList", () => {
  test("월주 丙寅, 순행", () => {
    expect(getDaeunGanjiList("丙寅", "forward", 3)).toEqual([
      "丁卯",
      "戊辰",
      "己巳",
    ]);
  });

  test("월주 丙寅, 역행", () => {
    expect(getDaeunGanjiList("丙寅", "backward", 3)).toEqual([
      "乙丑",
      "甲子",
      "癸亥",
    ]);
  });

  test("월주 간지가 60갑자에 없으면 오류", () => {
    expect(() => getDaeunGanjiList("甲甲", "forward", 1)).toThrow("Invalid ganji");
  });
});

describe("calculateDaeunStartAge", () => {
  test("차이가 정확히 12일이면 4년", () => {
    expect(calculateDaeunStartAge(
      new Date("2000-01-01T00:00:00+09:00"),
      new Date("2000-01-13T00:00:00+09:00")
    ).years).toBe(4);
  });

  test("차이가 정확히 1일이면 4개월", () => {
    const result = calculateDaeunStartAge(
      new Date("2000-01-01T00:00:00+09:00"),
      new Date("2000-01-02T00:00:00+09:00")
    );

    expect(result.years).toBe(0);
    expect(result.months).toBe(4);
  });

  test("차이가 정확히 1시간이면 5일", () => {
    const result = calculateDaeunStartAge(
      new Date("2000-01-01T00:00:00+09:00"),
      new Date("2000-01-01T01:00:00+09:00")
    );

    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
    expect(result.days).toBe(5);
  });
});

describe("findTargetTermForDaeun", () => {
  test("순행은 출생 후 다음 12절을 사용하고 중기는 무시", () => {
    const birth = new Date("1999-01-10T00:00:00+09:00");

    expect(findTargetTermForDaeun(birth, "forward", solarTerms).datetime)
      .toBe("1999-02-04T00:00:00+09:00");
  });

  test("역행은 출생 전 이전 12절을 사용한다", () => {
    const birth = new Date("1999-02-10T00:00:00+09:00");

    expect(findTargetTermForDaeun(birth, "backward", solarTerms).datetime)
      .toBe("1999-02-04T00:00:00+09:00");
  });

  test("출생 시각이 절입 1초 전이면 순행에서 해당 절기를 사용한다", () => {
    const birth = new Date("1999-02-03T23:59:59+09:00");

    expect(findTargetTermForDaeun(birth, "forward", solarTerms).datetime)
      .toBe("1999-02-04T00:00:00+09:00");
  });

  test("출생 시각이 절입 정각이면 순행은 다음 절기, 역행은 이전 절기를 사용한다", () => {
    const birth = new Date("1999-02-04T00:00:00+09:00");

    expect(findTargetTermForDaeun(birth, "forward", solarTerms).datetime)
      .toBe("1999-03-06T00:00:00+09:00");
    expect(findTargetTermForDaeun(birth, "backward", solarTerms).datetime)
      .toBe("1999-01-06T00:00:00+09:00");
  });

  test("출생 시각이 절입 1초 후이면 역행에서 해당 절기를 사용한다", () => {
    const birth = new Date("1999-02-04T00:00:01+09:00");

    expect(findTargetTermForDaeun(birth, "backward", solarTerms).datetime)
      .toBe("1999-02-04T00:00:00+09:00");
  });

  test("순행에서 다음 절기가 없으면 오류", () => {
    const birth = new Date("1999-04-06T00:00:00+09:00");

    expect(() => findTargetTermForDaeun(birth, "forward", solarTerms)).toThrow("다음 절기");
  });

  test("역행에서 이전 절기가 없으면 오류", () => {
    const birth = new Date("1999-01-01T00:00:00+09:00");

    expect(() => findTargetTermForDaeun(birth, "backward", solarTerms)).toThrow("이전 절기");
  });

  test("절기 데이터가 비어 있으면 오류", () => {
    const birth = new Date("1999-01-01T00:00:00+09:00");

    expect(() => findTargetTermForDaeun(birth, "forward", [])).toThrow("절기 데이터");
  });
});

describe("calculateDaeun", () => {
  const input = {
    birthDateTime: "1999-01-10T00:00:00+09:00",
    gender: "male" as const,
    pillars: {
      year: {
        stem: { hanja: "甲" },
        branch: { hanja: "子" },
        ganji: "甲子",
      },
      month: {
        stem: { hanja: "丙" },
        branch: { hanja: "寅" },
        ganji: "丙寅",
      },
      day: {},
      hour: {},
    },
    solarTerms,
  };

  test("계산 결과에 방향, 첫 대운 간지, 디버그 기준을 포함한다", () => {
    const result = calculateDaeun(input);

    expect(result.direction).toBe("forward");
    expect(result.cycles[0].ganji).toBe("丁卯");
    expect(result.targetSolarTerm.nameHanja).toBe("立春");
    expect(result.debug.directionBasis).toBe("yearStem");
    expect(result.debug.termMode).toBe("majorJieOnly");
  });

  test("성별 누락은 오류", () => {
    expect(() => calculateDaeun({ ...input, gender: undefined } as never)).toThrow("Gender is required");
  });

  test("출생 시각이 유효하지 않으면 오류", () => {
    expect(() => calculateDaeun({ ...input, birthDateTime: "not-a-date" })).toThrow("Invalid birthDateTime");
  });

  test("월주 간지 오류는 계산을 중단한다", () => {
    expect(() => calculateDaeun({
      ...input,
      pillars: {
        ...input.pillars,
        month: {
          ...input.pillars.month,
          ganji: "甲甲",
        },
      },
    })).toThrow("Invalid ganji");
  });

  test("절기 데이터 누락은 오류", () => {
    expect(() => calculateDaeun({ ...input, solarTerms: [] })).toThrow("절기 데이터");
  });
});
