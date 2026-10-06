// 사주 프로필 입력 규칙과 사주 계산. 화면과 서버가 같은 함수를 쓴다.
import { calculateSaju, ENGINE_VERSION, type Pillar } from "@saju/engine";
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

export function validateProfile(raw: Record<string, unknown>): Validation<ProfileInput> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "이름을 적어 주세요." };
  if (name.length > 40) return { ok: false, error: "이름은 40자까지 쓸 수 있어요." };

  if (raw.gender !== "male" && raw.gender !== "female") {
    return { ok: false, error: "성별을 골라 주세요. 대운 방향을 정하는 데 필요해요." };
  }
  const calendar = raw.calendar === "lunar" ? "lunar" : "solar";

  const birthYear = int(raw.birthYear);
  const birthMonth = int(raw.birthMonth);
  const birthDay = int(raw.birthDay);
  if (birthYear === null || birthYear < 1900 || birthYear > 2100) {
    return { ok: false, error: "태어난 해를 1900~2100 사이로 적어 주세요." };
  }
  if (birthMonth === null || birthMonth < 1 || birthMonth > 12) return { ok: false, error: "태어난 달을 확인해 주세요." };
  if (birthDay === null || birthDay < 1 || birthDay > 31) return { ok: false, error: "태어난 날을 확인해 주세요." };

  const timeUnknown = raw.timeUnknown === "on" || raw.timeUnknown === true;
  let birthHour: number | null = null;
  let birthMinute: number | null = null;
  if (!timeUnknown) {
    birthHour = int(raw.birthHour);
    birthMinute = int(raw.birthMinute ?? "0") ?? 0;
    if (birthHour === null || birthHour > 23) {
      return { ok: false, error: "태어난 시각을 0~23시로 적거나 ‘시간 모름’을 골라 주세요." };
    }
    if (birthMinute > 59) return { ok: false, error: "분은 0~59 사이로 적어 주세요." };
  }

  const city = CITIES.find((c) => c.id === raw.city)?.id ?? "seoul";

  return {
    ok: true,
    value: {
      name,
      gender: raw.gender,
      calendar,
      isLeapMonth: calendar === "lunar" && (raw.isLeapMonth === "on" || raw.isLeapMonth === true),
      birthYear,
      birthMonth,
      birthDay,
      birthHour,
      birthMinute,
      city,
    },
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
        location: { name: city.name, longitude: city.longitude },
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
