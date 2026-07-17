import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_PILLAR_VISIBILITY,
  resolvePillarVisibility,
  validateBirthDateTimeFields,
} from "@/lib/diary/sajuSettings";

describe("validateBirthDateTimeFields", () => {
  it("accepts a valid birth date without time", () => {
    expect(validateBirthDateTimeFields({
      year: "1990",
      month: "5",
      day: "15",
      hour: "",
      minute: "",
    })).toEqual({
      ok: true,
      birthDate: "1990-05-15",
      birthHour: undefined,
      birthMinute: undefined,
    });
  });

  it("accepts a valid birth date with time", () => {
    expect(validateBirthDateTimeFields({
      year: "2000",
      month: "02",
      day: "29",
      hour: "14",
      minute: "30",
    })).toEqual({
      ok: true,
      birthDate: "2000-02-29",
      birthHour: 14,
      birthMinute: 30,
    });
  });

  it("returns incomplete while date fields are partial", () => {
    expect(validateBirthDateTimeFields({
      year: "1999",
      month: "1",
      day: "",
      hour: "",
      minute: "",
    })).toEqual({
      ok: false,
      reason: "incomplete",
      message: "",
    });
  });

  it("rejects impossible calendar dates", () => {
    expect(validateBirthDateTimeFields({
      year: "1999",
      month: "2",
      day: "30",
      hour: "",
      minute: "",
    })).toEqual({
      ok: false,
      reason: "invalid",
      message: "생년월일을 다시 입력해주세요.",
    });
  });

  it("rejects out-of-range years", () => {
    expect(validateBirthDateTimeFields({
      year: "1899",
      month: "1",
      day: "1",
      hour: "",
      minute: "",
    }).ok).toBe(false);
  });

  it("rejects invalid hour and minute", () => {
    expect(validateBirthDateTimeFields({
      year: "1990",
      month: "1",
      day: "1",
      hour: "25",
      minute: "",
    })).toEqual({
      ok: false,
      reason: "invalid",
      message: "출생 시각을 다시 입력해주세요.",
    });

    expect(validateBirthDateTimeFields({
      year: "1990",
      month: "1",
      day: "1",
      hour: "10",
      minute: "70",
    })).toEqual({
      ok: false,
      reason: "invalid",
      message: "출생 시각을 다시 입력해주세요.",
    });
  });

  it("requires hour when minute is provided", () => {
    expect(validateBirthDateTimeFields({
      year: "1990",
      month: "1",
      day: "1",
      hour: "",
      minute: "30",
    })).toEqual({
      ok: false,
      reason: "invalid",
      message: "출생 시각을 다시 입력해주세요.",
    });
  });
});

describe("resolvePillarVisibility", () => {
  it("returns defaults when settings are missing", () => {
    expect(resolvePillarVisibility()).toEqual(DEFAULT_PILLAR_VISIBILITY);
    expect(DEFAULT_PILLAR_VISIBILITY.diary).toEqual({
      year: false,
      month: true,
      day: true,
    });
    expect(DEFAULT_PILLAR_VISIBILITY.daeun).toBe(false);
  });

  it("merges partial visibility with defaults", () => {
    expect(
      resolvePillarVisibility({
        pillarVisibility: {
          birth: { hour: false, day: true, month: true, year: true },
          diary: { year: true, month: false, day: true },
          daeun: false,
        },
      })
    ).toEqual({
      birth: { hour: false, day: true, month: true, year: true },
      diary: { year: true, month: false, day: true },
      daeun: false,
    });
  });
});
