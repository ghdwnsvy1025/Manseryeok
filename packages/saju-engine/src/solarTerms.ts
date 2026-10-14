/// <reference path="./lunar-javascript.d.ts" />
// ============================================================
// 절기(節氣) 계산 엔진
// 절입 시각: lunar-javascript의 寿星万年历 고정밀 태양 황경(VSOP87 축약 + ΔT)
//   한국천문연구원 발표 절입 시각과 초 단위까지 맞는다 (2024 입춘 17:27:07, 경칩 11:22:45)
//   (2026-10-15 이전엔 Meeus 25장 저정밀 식이라 KASI보다 2~6분 일렀다 — ENGINE_VERSION 1.1.0)
// 입춘(315°)은 년주, 12절입은 월주 경계
// ============================================================

import { ShouXingUtil } from "lunar-javascript";
import { jdeToKSTIso, mod } from "./jdn";

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

// 황경별 해당 그레고리력 대략 날짜 (지원 황경 목록 겸 참고값)
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
  // 12중기 (월주 경계는 아니지만 24절기 날짜용)
  300: { month: 1,  day: 20 }, // 대한
  330: { month: 2,  day: 19 }, // 우수
    0: { month: 3,  day: 21 }, // 춘분
   30: { month: 4,  day: 20 }, // 곡우
   60: { month: 5,  day: 21 }, // 소만
   90: { month: 6,  day: 21 }, // 하지
  120: { month: 7,  day: 23 }, // 대서
  150: { month: 8,  day: 23 }, // 처서
  180: { month: 9,  day: 23 }, // 추분
  210: { month: 10, day: 23 }, // 상강
  240: { month: 11, day: 22 }, // 소설
  270: { month: 12, day: 22 }, // 동지
};

/** 24절기, 황경 순(소한부터). jie = 월주 경계가 되는 절입 */
export const SOLAR_TERMS_24: readonly { lon: number; ko: string; jie: boolean }[] = [
  { lon: 285, ko: "소한", jie: true },
  { lon: 300, ko: "대한", jie: false },
  { lon: 315, ko: "입춘", jie: true },
  { lon: 330, ko: "우수", jie: false },
  { lon: 345, ko: "경칩", jie: true },
  { lon: 0, ko: "춘분", jie: false },
  { lon: 15, ko: "청명", jie: true },
  { lon: 30, ko: "곡우", jie: false },
  { lon: 45, ko: "입하", jie: true },
  { lon: 60, ko: "소만", jie: false },
  { lon: 75, ko: "망종", jie: true },
  { lon: 90, ko: "하지", jie: false },
  { lon: 105, ko: "소서", jie: true },
  { lon: 120, ko: "대서", jie: false },
  { lon: 135, ko: "입추", jie: true },
  { lon: 150, ko: "처서", jie: false },
  { lon: 165, ko: "백로", jie: true },
  { lon: 180, ko: "추분", jie: false },
  { lon: 195, ko: "한로", jie: true },
  { lon: 210, ko: "상강", jie: false },
  { lon: 225, ko: "입동", jie: true },
  { lon: 240, ko: "소설", jie: false },
  { lon: 255, ko: "대설", jie: true },
  { lon: 270, ko: "동지", jie: false },
];

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

/** 절기 계산 지원 범위. 입력 연도(1900-2100)의 앞뒤 해 절기까지 쓰므로 넉넉히 둔다 */
const SOLAR_TERM_MIN_YEAR = 1800;
const SOLAR_TERM_MAX_YEAR = 2200;

/**
 * 태양황경이 longitude에 도달하는 시각
 * year: 해당 황경이 속하는 그레고리력 연도 (소한·대한·입춘·우수·경칩은 1~3월, 나머지는 같은 해 3~12월)
 * Returns: 율리우스일 (UT 기준 — kstToJDE와 같은 기준. 이름은 옛 그대로 JDE)
 */
export function getSolarTermJDE(year: number, longitude: number): number {
  if (year < SOLAR_TERM_MIN_YEAR || year > SOLAR_TERM_MAX_YEAR) {
    throw new Error(
      `지원 범위(${SOLAR_TERM_MIN_YEAR}-${SOLAR_TERM_MAX_YEAR})를 벗어난 연도입니다: ${year}년. 절기 데이터를 확인할 수 없습니다.`
    );
  }
  if (!TERM_APPROX[longitude]) {
    throw new Error(`지원하지 않는 태양황경: ${longitude}°`);
  }

  // 寿星 누적 황경: 0 = 2000년 춘분이 아니라 1999년 춘분. 1~3월 절기(285°~345°)는 그 전 해 춘분에서 센다
  const cycle = longitude >= 285 ? year - 2000 : year - 1999;
  const w = ((cycle * 360 + longitude) * Math.PI) / 180;
  // qiAccurate: J2000 기준 일수, 베이징 시각(UT+8h). UT 율리우스일로 바꾼다
  return ShouXingUtil.qiAccurate(w) - 8 / 24 + 2451545;
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

const yearTermsCache = new Map<number, { ko: string; date: string }[]>();
/** 그 해의 24절기 입절일(KST 날짜 YYYY-MM-DD), 황경 순(소한 → 동지) */
export function solarTermsOfYear(year: number): { ko: string; date: string }[] {
  const hit = yearTermsCache.get(year);
  if (hit) return hit;
  const list = SOLAR_TERMS_24.map((t) => ({ ko: t.ko, date: getSolarTermKSTIso(year, t.lon).slice(0, 10) }));
  yearTermsCache.set(year, list);
  return list;
}
