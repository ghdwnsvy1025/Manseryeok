// ============================================================
// 음력→양력 변환
// korean-lunar-calendar 라이브러리 사용 (한국천문연구원 음력, 동경 135°)
// lunar-javascript는 중국 음력(동경 120°)이라 초하루·윤달 위치가 한국과 다른 달이 있어 쓰지 않는다
// ============================================================

import KoreanLunarCalendar from "korean-lunar-calendar";

/** 한국 음력 데이터가 있는 범위 (korean-lunar-calendar: 음력 2050년 11월 18일까지) */
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2050;

export interface LunarConversionResult {
  inputLunar: {
    year: number;
    month: number;
    day: number;
    isLeap: boolean;
  };
  outputSolar: {
    year: number;
    month: number;
    day: number;
  };
  outputSolarString: string;
  source: string;
}

/**
 * 음력 날짜를 양력으로 변환
 * @param year   - 음력 연도
 * @param month  - 음력 월 (1-12)
 * @param day    - 음력 일
 * @param isLeap - 윤달 여부
 */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeap: boolean
): LunarConversionResult {
  if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) {
    throw new Error(
      `음력 변환 지원 범위(${LUNAR_MIN_YEAR}-${LUNAR_MAX_YEAR})를 벗어났습니다: ${year}년`
    );
  }
  if (month < 1 || month > 12) {
    throw new Error(`음력 월 범위 오류: ${month}월 (1-12 사이여야 합니다)`);
  }
  if (day < 1 || day > 30) {
    throw new Error(`음력 일 범위 오류: ${day}일 (1-30 사이여야 합니다)`);
  }

  const notExist = () =>
    new Error(
      `음력 ${year}년 ${isLeap ? "윤" : ""}${month}월 ${day}일은 존재하지 않거나 윤달 여부가 올바르지 않습니다.`
    );

  const cal = new KoreanLunarCalendar();
  if (!cal.setLunarDate(year, month, day, isLeap)) throw notExist();
  const solar = cal.getSolarCalendar();

  // 변환 결과 역검증: 양력→음력으로 되돌려 확인 (없는 30일·없는 윤달이 이웃 날짜로 밀리는 것을 막는다)
  const back = new KoreanLunarCalendar();
  back.setSolarDate(solar.year, solar.month, solar.day);
  const lunarBack = back.getLunarCalendar();
  if (
    lunarBack.year !== year ||
    lunarBack.month !== month ||
    lunarBack.day !== day ||
    Boolean(lunarBack.intercalation) !== isLeap
  ) {
    throw notExist();
  }

  const sy = solar.year;
  const sm = solar.month;
  const sd = solar.day;
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    inputLunar: { year, month, day, isLeap },
    outputSolar: { year: sy, month: sm, day: sd },
    outputSolarString: `${sy}-${pad(sm)}-${pad(sd)}`,
    source: "korean-lunar-calendar (한국천문연구원 음력)",
  };
}
