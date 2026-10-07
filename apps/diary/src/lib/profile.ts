// 사주 프로필 입력 규칙과 사주 계산. 화면과 서버가 같은 함수를 쓴다.
import { calculateSaju, ENGINE_VERSION, lunarToSolar, type Pillar } from "@saju/engine";
import type { Validation } from "./entry";
import { CITIES, type CityId } from "./cities";

export { CITIES, type CityId };


export interface ProfileInput {
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  /** null = 시간 모름 */
  birthHour: number | null;
  birthMinute: number | null;
  city: CityId;
}

/** 운세 계산에 필요한 출생 정보 (이름 제외). 게스트 쿠키(GuestProfile)와 같은 모양 */
export type BirthProfile = Omit<ProfileInput, "name">;

export interface PillarSnapshot {
  stem: string; // 한자
  branch: string;
  ko: string; // "경술"
}

export interface PillarsSnapshot {
  year: PillarSnapshot;
  month: PillarSnapshot;
  day: PillarSnapshot;
  hour: PillarSnapshot | null;
}

export interface ComputedProfile {
  pillars: PillarsSnapshot;
  engineVersion: string;
}

function int(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/** 검증에 걸린 입력 묶음 — 화면이 그 묶음만 오류로 표시한다 (B3). 화면 순서: 이름 → 달력 → 날짜 → 시각 → 도시 → 성별 */
export type ProfileField = "name" | "calendar" | "date" | "time" | "city" | "gender";

export type ProfileValidation = { ok: true; value: ProfileInput } | { ok: false; error: string; field: ProfileField };

export const GENDER_ERROR = "성별을 골라 주세요. 운세 계산에 필요해요.";
/** 엔진(computeProfile)이 거절했을 때 사용자에게 보이는 문구 — 엔진의 "~해주세요" 문구는 내보내지 않는다 */
export const COMPUTE_ERROR = "생년월일을 다시 확인해 주세요.";

function fail(field: ProfileField, error: string): ProfileValidation {
  return { ok: false, error, field };
}

/** 그 해·달에 그 날이 있는지. 양력은 Date 왕복, 음력은 엔진의 lunarToSolar(없는 날이면 throw) */
export function dateExists(calendar: "solar" | "lunar", year: number, month: number, day: number, isLeapMonth = false): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (calendar === "solar") {
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  }
  try {
    lunarToSolar(year, month, day, isLeapMonth);
    return true;
  } catch {
    return false;
  }
}

/** 이름 한 칸 검증 (온보딩·설정 "이름" 공용, B4). 앞뒤 공백을 지운 1~40자 */
export function validateName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { ok: false, error: "이름을 적어 주세요." };
  if (name.length > 40) return { ok: false, error: "이름은 40자까지 쓸 수 있어요." };
  return { ok: true, value: name };
}

/**
 * 입력 검증. 화면 순서대로 걸리고, 어느 묶음에서 걸렸는지 field로 알린다.
 * 엔진 오류 문구("~해주세요", "1900-2100 범위")가 사용자에게 가지 않도록 날짜·시각·성별은 여기서 먼저 잡는다.
 */
export function validateProfile(raw: Record<string, unknown>): ProfileValidation {
  const checkedName = validateName(raw.name);
  if (!checkedName.ok) return fail("name", checkedName.error);
  const name = checkedName.value;

  if (raw.calendar !== "solar" && raw.calendar !== "lunar") return fail("calendar", "양력인지 음력인지 골라 주세요.");
  const calendar = raw.calendar;
  const isLeapMonth = calendar === "lunar" && (raw.isLeapMonth === "on" || raw.isLeapMonth === true);

  const birthYear = int(raw.birthYear);
  const birthMonth = int(raw.birthMonth);
  const birthDay = int(raw.birthDay);
  if (birthYear === null || birthYear < 1900 || birthYear > 2100) return fail("date", "태어난 해를 확인해 주세요.");
  if (birthMonth === null || birthMonth < 1 || birthMonth > 12) return fail("date", "태어난 달을 확인해 주세요.");
  if (birthDay === null || birthDay < 1 || birthDay > 31) return fail("date", "태어난 날을 확인해 주세요.");
  if (!dateExists(calendar, birthYear, birthMonth, birthDay, isLeapMonth)) {
    return fail("date", `${calendar === "lunar" ? "음력 " : ""}${isLeapMonth ? "윤" : ""}${birthMonth}월 ${birthDay}일은 없는 날이에요.`);
  }

  const timeUnknown = raw.timeUnknown === "on" || raw.timeUnknown === true;
  let birthHour: number | null = null;
  let birthMinute: number | null = null;
  if (!timeUnknown) {
    birthHour = int(raw.birthHour);
    birthMinute = int(raw.birthMinute ?? "0") ?? 0;
    if (birthHour === null || birthHour > 23) return fail("time", "태어난 시각을 0~23시로 적거나 ‘몰라요’를 골라 주세요.");
    if (birthMinute > 59) return fail("time", "분은 0~59 사이로 적어 주세요.");
  }

  const city = CITIES.find((c) => c.id === raw.city)?.id;
  if (!city) return fail("city", "태어난 곳을 골라 주세요.");

  if (raw.gender !== "male" && raw.gender !== "female") return fail("gender", GENDER_ERROR);

  return {
    ok: true,
    value: { name, gender: raw.gender, calendar, isLeapMonth, birthYear, birthMonth, birthDay, birthHour, birthMinute, city },
  };
}

function snap(p: Pillar): PillarSnapshot {
  return { stem: p.stem.hanja, branch: p.branch.hanja, ko: p.ganjiKo };
}

/** 레거시와 같은 기준: 자정에 날 바뀜 · 진태양시 보정 · 출생지 경도 */
export function computeProfile(input: ProfileInput): Validation<ComputedProfile> {
  const city = CITIES.find((c) => c.id === input.city) ?? CITIES[0];
  try {
    const r = calculateSaju({
      year: input.birthYear,
      month: input.birthMonth,
      day: input.birthDay,
      hour: input.birthHour ?? undefined,
      minute: input.birthMinute ?? undefined,
      gender: input.gender,
      options: {
        calendarType: input.calendar,
        isLeapMonth: input.isLeapMonth,
        timezone: "Asia/Seoul",
        location: { name: city.coreName, longitude: city.longitude },
        dayChangeRule: "midnight",
        timeCorrection: "trueSolarTime",
      },
    });
    return {
      ok: true,
      value: {
        pillars: {
          year: snap(r.pillars.year),
          month: snap(r.pillars.month),
          day: snap(r.pillars.day),
          hour: r.pillars.hour ? snap(r.pillars.hour) : null,
        },
        engineVersion: ENGINE_VERSION,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
