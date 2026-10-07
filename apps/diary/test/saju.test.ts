import { describe, expect, test } from "vitest";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, validateProfile } from "@/lib/profile";
import { addDays, formatKoreanDate, parseYmd, todayKST } from "@/lib/time";

describe("일진", () => {
  test("기준일 2019-01-27은 갑자일", () => {
    expect(dayGanji("2019-01-27")).toMatchObject({ index: 0, ko: "갑자", hanja: "甲子" });
  });

  test("2026-10-03 경술일, 다음 날 신해일 (레거시 화면과 같음)", () => {
    expect(dayGanji("2026-10-03").ko).toBe("경술");
    expect(dayGanji(addDays("2026-10-03", 1)).ko).toBe("신해");
  });

  test("60일마다 같은 간지", () => {
    expect(dayGanji(addDays("2026-10-03", 60)).index).toBe(dayGanji("2026-10-03").index);
  });
});

describe("시간", () => {
  test("한국 날짜는 UTC 자정 전후로 하루가 갈린다", () => {
    expect(todayKST(new Date("2026-10-03T14:59:00Z"))).toBe("2026-10-03");
    expect(todayKST(new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-04");
  });
  test("없는 날짜는 null", () => {
    expect(parseYmd("2026-02-29")).toBeNull();
    expect(parseYmd("2028-02-29")).not.toBeNull();
  });
  test("한국어 날짜", () => {
    expect(formatKoreanDate("2026-10-03")).toBe("10월 3일 토요일");
    expect(formatKoreanDate("2026-10-04")).toBe("10월 4일 일요일");
  });
});

describe("사주 프로필", () => {
  const form = {
    name: "테스트",
    gender: "male",
    calendar: "solar",
    birthYear: "1990",
    birthMonth: "1",
    birthDay: "1",
    birthHour: "12",
    birthMinute: "0",
    city: "seoul",
  };

  test("레거시 화면과 같은 네 기둥 (1990-01-01 12:00 서울)", () => {
    const v = validateProfile(form);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const c = computeProfile(v.value);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.value.pillars.year.ko).toBe("기사");
    expect(c.value.pillars.month.ko).toBe("병자");
    expect(c.value.pillars.day.ko).toBe("병인");
    expect(c.value.pillars.hour?.ko).toBe("갑오");
  });

  test("시간 모름이면 시주 없음", () => {
    const v = validateProfile({ ...form, timeUnknown: "on", birthHour: "", birthMinute: "" });
    expect(v.ok && v.value.birthHour).toBeNull();
    if (!v.ok) return;
    const c = computeProfile(v.value);
    expect(c.ok && c.value.pillars.hour).toBeNull();
  });

  test("음력 30일은 그 달에 있으면 받고, 29일까지인 달이면 오류", () => {
    // 1990년 음력 2월은 30일까지, 3월은 29일까지
    const ok = validateProfile({ ...form, calendar: "lunar", birthMonth: "2", birthDay: "30" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(computeProfile(ok.value).ok).toBe(true);
    // B3: 없는 음력 날은 엔진까지 가지 않고 validateProfile이 먼저 잡는다
    const bad = validateProfile({ ...form, calendar: "lunar", birthMonth: "3", birthDay: "30" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.field).toBe("date");
  });

  test("성별과 시각 검증", () => {
    expect(validateProfile({ ...form, gender: "" }).ok).toBe(false);
    expect(validateProfile({ ...form, birthHour: "24" }).ok).toBe(false);
    expect(validateProfile({ ...form, birthHour: "" }).ok).toBe(false);
  });
});
