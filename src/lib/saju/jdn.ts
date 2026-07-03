// ============================================================
// Julian Day Number 변환
// Jean Meeus "Astronomical Algorithms" Chapter 7
// ============================================================

/**
 * 그레고리력 날짜를 Julian Day Number로 변환
 * JDN은 정오(noon UT) 기준의 정수
 */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Julian Day Number (및 소수 부분)를 그레고리력 날짜/시각으로 변환
 * Jean Meeus Chapter 7 Algorithm
 */
export function jdnToGregorian(jd: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const jd1 = jd + 0.5;
  const Z = Math.floor(jd1);
  const F = jd1 - Z;

  let A: number;
  if (Z < 2299161) {
    A = Z;
  } else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  const hourFrac = F * 24;
  const hour = Math.floor(hourFrac);
  const minFrac = (hourFrac - hour) * 60;
  const minute = Math.floor(minFrac);
  const second = Math.round((minFrac - minute) * 60);

  return { year, month, day, hour, minute, second };
}

/** 양수 모듈로 (JavaScript % 는 음수 반환 가능) */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** JDN(날짜) + UTC 시각(시, 분) → JDE */
export function toJDE(jdn: number, utcHour: number, utcMinute: number): number {
  return jdn - 0.5 + (utcHour * 60 + utcMinute) / 1440.0;
}

/** KST datetime → JDE (KST = UTC+9) */
export function kstToJDE(
  year: number,
  month: number,
  day: number,
  kstHour: number,
  kstMinute: number
): number {
  // KST → UTC: -9시간
  let utcHour = kstHour - 9;
  let utcMinute = kstMinute;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      utcDay = daysInMonth(utcYear, utcMonth);
    }
  }

  const jdn = gregorianToJdn(utcYear, utcMonth, utcDay);
  return toJDE(jdn, utcHour, utcMinute);
}

/** 해당 월의 일 수 반환 (그레고리력) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** JDE → KST ISO string */
export function jdeToKSTIso(jde: number): string {
  // UTC+9 적용
  const kstJD = jde + 9.0 / 24.0;
  const { year, month, day, hour, minute, second } = jdnToGregorian(kstJD);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+09:00`;
}
