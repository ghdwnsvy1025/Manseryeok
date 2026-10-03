// ============================================================
// 절기(節氣) 계산 엔진
// Jean Meeus "Astronomical Algorithms" 2nd Edition, Chapter 25
// 정확도: ~0.01°~0.05° ≈ 15~45분 (1800-2200년 유효)
//
// 중요: 월주 경계가 되는 12개 절입만 구현
// 입춘(315°)은 년주 판단에도 사용
// ============================================================

import { gregorianToJdn, jdeToKSTIso, mod } from "./jdn";

const DEG2RAD = Math.PI / 180;

/** 절기 태양황경 → 절기 한국어 이름 */
export const SOLAR_TERM_INFO: Record<number, { ko: string; hanja: string }> = {
  315: { ko: "입춘", hanja: "立春" },
  345: { ko: "경칩", hanja: "驚蟄" },
   15: { ko: "청명", hanja: "淸明" },
   45: { ko: "입하", hanja: "立夏" },
   75: { ko: "망종", hanja: "芒種" },
  105: { ko: "소서", hanja: "小暑" },
  135: { ko: "입추", hanja: "立秋" },
  165: { ko: "백로", hanja: "白露" },
  195: { ko: "한로", hanja: "寒露" },
  225: { ko: "입동", hanja: "立冬" },
  255: { ko: "대설", hanja: "大雪" },
  285: { ko: "소한", hanja: "小寒" },
};

// 황경별 해당 그레고리력 대략 날짜 (Newton-Raphson 초기값)
const TERM_APPROX: Record<number, { month: number; day: number }> = {
  285: { month: 1,  day: 6  }, // 소한
  315: { month: 2,  day: 4  }, // 입춘
  345: { month: 3,  day: 6  }, // 경칩
   15: { month: 4,  day: 5  }, // 청명
   45: { month: 5,  day: 6  }, // 입하
   75: { month: 6,  day: 6  }, // 망종
  105: { month: 7,  day: 7  }, // 소서
  135: { month: 8,  day: 7  }, // 입추
  165: { month: 9,  day: 8  }, // 백로
  195: { month: 10, day: 8  }, // 한로
  225: { month: 11, day: 7  }, // 입동
  255: { month: 12, day: 7  }, // 대설
};

/**
 * 태양의 겉보기 황경(apparent geocentric ecliptic longitude, degrees)
 * T: 율리우스 세기 (Julian centuries from J2000.0)
 */
export function sunApparentLongitude(jde: number): number {
  const T = (jde - 2451545.0) / 36525.0;

  // 기하학적 평균 황경 (Geometric Mean Longitude)
  const L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);

  // 평균 근점이각 (Mean Anomaly)
  const M = mod(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360);
  const Mrad = M * DEG2RAD;

  // 중심 방정식 (Equation of the Center)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // 진황경 (True Longitude)
  const sunTrue = L0 + C;

  // 겉보기 황경 (장동 + 광행차 보정)
  const omega = mod(125.04 - 1934.136 * T, 360);
  const apparent = sunTrue - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD);

  return mod(apparent, 360);
}

/**
 * 태양황경이 targetLongitude에 도달하는 JDE (Newton-Raphson 반복)
 * year: 해당 황경이 속하는 그레고리력 연도
 * Returns: JDE (UT 기준)
 */
export function getSolarTermJDE(year: number, longitude: number): number {
  if (year < 1900 || year > 2100) {
    throw new Error(
      `지원 범위(1900-2100)를 벗어난 연도입니다: ${year}년. 절기 데이터를 확인할 수 없습니다.`
    );
  }

  const approx = TERM_APPROX[longitude];
  if (!approx) {
    throw new Error(`지원하지 않는 태양황경: ${longitude}°`);
  }

  // 시작 JDE: 대략 날짜의 자정(UTC)
  const startJDN = gregorianToJdn(year, approx.month, approx.day);
  let jde = startJDN - 0.5;

  // Newton-Raphson 반복 (최대 50회, 수렴 기준: ~1분)
  for (let i = 0; i < 50; i++) {
    const lng = sunApparentLongitude(jde);

    // 각도 차 (360° 랩어라운드 처리)
    let delta = longitude - lng;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // 보정 (태양은 평균 365.25일에 360° 이동)
    const correction = (delta / 360.0) * 365.25;
    jde += correction;

    if (Math.abs(correction) < 1.0 / 1440.0) break; // 1분 정밀도
  }

  return jde;
}

/** KST ISO 문자열 반환 */
export function getSolarTermKSTIso(year: number, longitude: number): string {
  const jde = getSolarTermJDE(year, longitude);
  return jdeToKSTIso(jde);
}

/** 균시차 (Equation of Time, 분 단위) — 진태양시 보정용 */
export function equationOfTime(jde: number): number {
  const T = (jde - 2451545.0) / 36525.0;
  const epsilon = (23.4392911 - 0.013004167 * T) * DEG2RAD;
  const L0 = mod(280.46646 + 36000.76983 * T, 360) * DEG2RAD;
  const e = 0.016708634 - 0.000042037 * T;
  const M = mod(357.52911 + 35999.05029 * T, 360) * DEG2RAD;

  const y = Math.tan(epsilon / 2) ** 2;
  const E =
    y * Math.sin(2 * L0) -
    2 * e * Math.sin(M) +
    4 * e * y * Math.sin(M) * Math.cos(2 * L0) -
    0.5 * y * y * Math.sin(4 * L0) -
    1.25 * e * e * Math.sin(2 * M);

  return E * (1440 / (2 * Math.PI)); // 분 단위
}
