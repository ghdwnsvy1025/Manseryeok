import {
  calculateHiddenStems,
  getHiddenStemsByBranch,
  getTenGod,
} from "@/lib/saju/hiddenStems";

describe("getHiddenStemsByBranch", () => {
  test("기본 지장간 표준표를 지지별로 반환한다", () => {
    expect(getHiddenStemsByBranch("子").map((x) => x.stem)).toEqual(["壬", "癸"]);
    expect(getHiddenStemsByBranch("丑").map((x) => x.stem)).toEqual(["癸", "辛", "己"]);
    expect(getHiddenStemsByBranch("寅").map((x) => x.stem)).toEqual(["戊", "丙", "甲"]);
    expect(getHiddenStemsByBranch("卯").map((x) => x.stem)).toEqual(["甲", "乙"]);
    expect(getHiddenStemsByBranch("辰").map((x) => x.stem)).toEqual(["乙", "癸", "戊"]);
    expect(getHiddenStemsByBranch("巳").map((x) => x.stem)).toEqual(["戊", "庚", "丙"]);
    expect(getHiddenStemsByBranch("午").map((x) => x.stem)).toEqual(["丙", "己", "丁"]);
    expect(getHiddenStemsByBranch("未").map((x) => x.stem)).toEqual(["丁", "乙", "己"]);
    expect(getHiddenStemsByBranch("申").map((x) => x.stem)).toEqual(["戊", "壬", "庚"]);
    expect(getHiddenStemsByBranch("酉").map((x) => x.stem)).toEqual(["庚", "辛"]);
    expect(getHiddenStemsByBranch("戌").map((x) => x.stem)).toEqual(["辛", "丁", "戊"]);
    expect(getHiddenStemsByBranch("亥").map((x) => x.stem)).toEqual(["戊", "甲", "壬"]);
  });

  test("여기, 중기, 정기 역할을 분리한다", () => {
    expect(getHiddenStemsByBranch("寅").map((x) => x.roleKo)).toEqual([
      "여기",
      "중기",
      "정기",
    ]);

    expect(getHiddenStemsByBranch("子").map((x) => x.roleKo)).toEqual([
      "여기",
      "정기",
    ]);
  });

  test("존재하지 않는 지지는 오류", () => {
    expect(() => getHiddenStemsByBranch("INVALID")).toThrow("올바르지 않은 지지");
  });
});

describe("calculateHiddenStems", () => {
  test("전체 원국의 지장간을 조회하고 시주 null은 제외한다", () => {
    const result = calculateHiddenStems({
      year: { stem: { hanja: "甲" }, branch: { hanja: "子" }, ganji: "甲子" },
      month: { stem: { hanja: "丙" }, branch: { hanja: "寅" }, ganji: "丙寅" },
      day: { stem: { hanja: "甲" }, branch: { hanja: "辰" }, ganji: "甲辰" },
      hour: null,
    });

    expect(result.profile).toBe("koreanStandardThreeStage");
    expect(result.items).toHaveLength(3);
    expect(result.items[0].hiddenStems.map((x) => x.stem)).toEqual(["壬", "癸"]);
    expect(result.items[1].hiddenStems.map((x) => x.stem)).toEqual(["戊", "丙", "甲"]);
    expect(result.items[2].hiddenStems.map((x) => x.stem)).toEqual(["乙", "癸", "戊"]);
  });

  test("일간 기준 십성을 함께 계산한다", () => {
    const result = calculateHiddenStems({
      year: { stem: { hanja: "甲" }, branch: { hanja: "子" }, ganji: "甲子" },
      month: { stem: { hanja: "丙" }, branch: { hanja: "寅" }, ganji: "丙寅" },
      day: { stem: { hanja: "甲" }, branch: { hanja: "辰" }, ganji: "甲辰" },
      hour: null,
    });

    expect(result.items[1].hiddenStems.map((x) => x.tenGod)).toEqual([
      "편재",
      "식신",
      "비견",
    ]);
  });

  test("원국에 올바르지 않은 지지가 있으면 오류", () => {
    expect(() => calculateHiddenStems({
      year: { stem: { hanja: "甲" }, branch: { hanja: "INVALID" }, ganji: "甲子" },
      month: { stem: { hanja: "丙" }, branch: { hanja: "寅" }, ganji: "丙寅" },
      day: { stem: { hanja: "甲" }, branch: { hanja: "辰" }, ganji: "甲辰" },
      hour: null,
    })).toThrow("Invalid branch");
  });

  test("일간이 올바르지 않으면 십성 계산을 중단한다", () => {
    expect(() => calculateHiddenStems({
      year: { stem: { hanja: "甲" }, branch: { hanja: "子" }, ganji: "甲子" },
      month: { stem: { hanja: "丙" }, branch: { hanja: "寅" }, ganji: "丙寅" },
      day: { stem: { hanja: "INVALID" }, branch: { hanja: "辰" }, ganji: "甲辰" },
      hour: null,
    })).toThrow("Invalid day stem");
  });
});

describe("getTenGod", () => {
  test("천간 오행과 음양으로 십성을 계산한다", () => {
    expect(getTenGod("甲", "甲")).toBe("비견");
    expect(getTenGod("甲", "乙")).toBe("겁재");
    expect(getTenGod("甲", "丙")).toBe("식신");
    expect(getTenGod("甲", "丁")).toBe("상관");
    expect(getTenGod("甲", "戊")).toBe("편재");
    expect(getTenGod("甲", "己")).toBe("정재");
    expect(getTenGod("甲", "庚")).toBe("편관");
    expect(getTenGod("甲", "辛")).toBe("정관");
    expect(getTenGod("甲", "壬")).toBe("편인");
    expect(getTenGod("甲", "癸")).toBe("정인");
  });
});
