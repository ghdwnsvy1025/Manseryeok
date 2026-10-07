// 온보딩 검증 (B3): 화면 순서대로 걸리고, 어느 묶음인지 field로 알리고, 엔진 문구가 새지 않는다
import { describe, expect, test } from "vitest";
import { COMPUTE_ERROR, GENDER_ERROR, dateExists, validateProfile } from "@/lib/profile";

const good = {
  name: "테스트",
  gender: "female",
  calendar: "solar",
  birthYear: "1995",
  birthMonth: "3",
  birthDay: "14",
  birthHour: "7",
  birthMinute: "30",
  city: "seoul",
};

function failOf(raw: Record<string, unknown>) {
  const v = validateProfile(raw);
  if (v.ok) throw new Error("통과하면 안 됨");
  return v;
}

describe("validateProfile 순서와 field", () => {
  test("다 맞으면 통과한다", () => {
    const v = validateProfile(good);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value).toMatchObject({ gender: "female", calendar: "solar", birthYear: 1995, birthHour: 7, birthMinute: 30, city: "seoul" });
  });

  test("달력 → 날짜 → 시각 → 도시 → 성별 순서로 걸린다 (다 틀렸을 때 앞의 것부터)", () => {
    const allBad = { ...good, calendar: "", birthYear: "1800", birthHour: "25", city: "nowhere", gender: "" };
    expect(failOf(allBad).field).toBe("calendar");
    expect(failOf({ ...allBad, calendar: "solar" }).field).toBe("date");
    expect(failOf({ ...allBad, calendar: "solar", birthYear: "1995" }).field).toBe("time");
    expect(failOf({ ...allBad, calendar: "solar", birthYear: "1995", birthHour: "9" }).field).toBe("city");
    expect(failOf({ ...allBad, calendar: "solar", birthYear: "1995", birthHour: "9", city: "seoul" }).field).toBe("gender");
  });

  test("이름이 비면 name (Google 사용자). 익명은 서버가 '손님'을 넣어 부른다", () => {
    expect(failOf({ ...good, name: "" }).field).toBe("name");
  });

  test("해는 1900~2100: 벗어나면 '태어난 해를 확인해 주세요.' — 엔진의 '1900-2100 범위' 문구가 아니다", () => {
    for (const y of ["1899", "2101", "abc", ""]) {
      const r = failOf({ ...good, birthYear: y });
      expect(r.field).toBe("date");
      expect(r.error).toBe("태어난 해를 확인해 주세요.");
      expect(r.error).not.toMatch(/1900-2100|해주세요/);
    }
    expect(validateProfile({ ...good, birthYear: "1900" }).ok).toBe(true);
    expect(validateProfile({ ...good, birthYear: "2100" }).ok).toBe(true);
  });

  test("2월 30일은 '2월 30일은 없는 날이에요' (field date)", () => {
    const r = failOf({ ...good, birthMonth: "2", birthDay: "30" });
    expect(r.field).toBe("date");
    expect(r.error).toBe("2월 30일은 없는 날이에요.");
    // 윤년·평년 2월 29일
    expect(validateProfile({ ...good, birthYear: "1996", birthMonth: "2", birthDay: "29" }).ok).toBe(true);
    expect(failOf({ ...good, birthYear: "1995", birthMonth: "2", birthDay: "29" }).error).toBe("2월 29일은 없는 날이에요.");
    expect(failOf({ ...good, birthMonth: "4", birthDay: "31" }).error).toBe("4월 31일은 없는 날이에요.");
    expect(failOf({ ...good, birthMonth: "13", birthDay: "1" }).error).toBe("태어난 달을 확인해 주세요.");
    expect(failOf({ ...good, birthMonth: "1", birthDay: "0" }).error).toBe("태어난 날을 확인해 주세요.");
  });

  test("음력도 없는 날을 먼저 잡는다 (1990년 음력 3월은 29일까지, 윤5월 있음)", () => {
    expect(validateProfile({ ...good, calendar: "lunar", birthYear: "1990", birthMonth: "2", birthDay: "30" }).ok).toBe(true);
    const r = failOf({ ...good, calendar: "lunar", birthYear: "1990", birthMonth: "3", birthDay: "30" });
    expect(r.field).toBe("date");
    expect(r.error).toBe("음력 3월 30일은 없는 날이에요.");
    expect(validateProfile({ ...good, calendar: "lunar", birthYear: "1990", birthMonth: "5", birthDay: "1", isLeapMonth: "on" }).ok).toBe(true);
    const leap = failOf({ ...good, calendar: "lunar", birthYear: "1990", birthMonth: "6", birthDay: "1", isLeapMonth: "on" });
    expect(leap.error).toBe("음력 윤6월 1일은 없는 날이에요.");
    expect(dateExists("lunar", 1990, 3, 30)).toBe(false);
    expect(dateExists("solar", 2000, 2, 29)).toBe(true);
  });

  test("시각은 '몰라요'가 아닐 때만 본다 (field time)", () => {
    const r = failOf({ ...good, birthHour: "24" });
    expect(r.field).toBe("time");
    expect(failOf({ ...good, birthHour: "" }).field).toBe("time");
    expect(failOf({ ...good, birthMinute: "60" }).error).toBe("분은 0~59 사이로 적어 주세요.");
    const v = validateProfile({ ...good, timeUnknown: "on", birthHour: "99", birthMinute: "" });
    expect(v.ok && v.value.birthHour).toBeNull();
  });

  test("성별 문구에 '대운 방향'이 없다", () => {
    const r = failOf({ ...good, gender: "" });
    expect(r.field).toBe("gender");
    expect(r.error).toBe("성별을 골라 주세요. 운세 계산에 필요해요.");
    expect(GENDER_ERROR).not.toMatch(/대운/);
  });

  test("달력·도시가 이상하면 각각 calendar·city. 엔진 실패 문구도 '~해주세요'가 아니다", () => {
    expect(failOf({ ...good, calendar: "julian" }).field).toBe("calendar");
    expect(failOf({ ...good, city: "mars" }).field).toBe("city");
    expect(COMPUTE_ERROR).not.toMatch(/해주세요/);
  });
});
