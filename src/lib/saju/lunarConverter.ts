// ============================================================
// 음력→양력 변환
// lunar-javascript 라이브러리 사용
// 참고: 음력 윤달은 month에 음수(-) 사용
// ============================================================

import { Lunar } from "lunar-javascript";

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
  if (year < 1900 || year > 2100) {
    throw new Error(
      `음력 변환 지원 범위(1900-2100)를 벗어났습니다: ${year}년`
    );
  }
  if (month < 1 || month > 12) {
    throw new Error(`음력 월 범위 오류: ${month}월 (1-12 사이여야 합니다)`);
  }
  if (day < 1 || day > 30) {
    throw new Error(`음력 일 범위 오류: ${day}일 (1-30 사이여야 합니다)`);
  }

  // lunar-javascript: 윤달은 음수 월로 표현
  const lunarMonth = isLeap ? -Math.abs(month) : month;

  let solar;
  try {
    const lunar = Lunar.fromYmd(year, lunarMonth, day);
    solar = lunar.getSolar();

    // 변환 결과 역검증: 양력→음력으로 되돌려 확인
    const lunarBack = solar.getLunar();
    const backMonth = Math.abs(lunarBack.getMonth());
    const backIsLeap = lunarBack.isLeap();

    if (
      lunarBack.getYear() !== year ||
      backMonth !== month ||
      lunarBack.getDay() !== day ||
      backIsLeap !== isLeap
    ) {
      throw new Error(
        `음력 ${year}년 ${isLeap ? "윤" : ""}${month}월 ${day}일은 존재하지 않거나 윤달 여부가 올바르지 않습니다.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("존재하지")) {
      throw err;
    }
    throw new Error(
      `음력 변환 실패: ${year}년 ${isLeap ? "윤" : ""}${month}월 ${day}일. ` +
        `해당 날짜가 존재하지 않거나 윤달 여부를 확인하세요.`
    );
  }

  const sy = solar.getYear();
  const sm = solar.getMonth();
  const sd = solar.getDay();
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    inputLunar: { year, month, day, isLeap },
    outputSolar: { year: sy, month: sm, day: sd },
    outputSolarString: `${sy}-${pad(sm)}-${pad(sd)}`,
    source: "lunar-javascript (한중 음양력 변환 DB)",
  };
}
