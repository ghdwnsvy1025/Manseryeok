// 24절기 — 운세 글의 "오늘 재료"(v4.4). 엔진(@saju/engine)은 월주 경계가 되는 12절입만 계산하므로,
// 12중기(우수·춘분·곡우·소만·하지·대서·처서·추분·상강·소설·동지·대한)는 같은 엔진의 sunApparentLongitude로 같은 방식(뉴턴 반복)으로 구한다.
// 12절입은 엔진 getSolarTermKSTIso를 그대로 써서 코어 monthGanjiList(월운 경계)와 날짜가 어긋나지 않게 한다.
import { getSolarTermKSTIso, gregorianToJdn, jdeToKSTIso, sunApparentLongitude } from "@saju/engine";

/** 황경 순(소한부터). jie = 월주 경계(절입) */
export const TERMS_24: { lon: number; ko: string; month: number; day: number; jie: boolean }[] = [
  { lon: 285, ko: "소한", month: 1, day: 6, jie: true },
  { lon: 300, ko: "대한", month: 1, day: 20, jie: false },
  { lon: 315, ko: "입춘", month: 2, day: 4, jie: true },
  { lon: 330, ko: "우수", month: 2, day: 19, jie: false },
  { lon: 345, ko: "경칩", month: 3, day: 6, jie: true },
  { lon: 0, ko: "춘분", month: 3, day: 21, jie: false },
  { lon: 15, ko: "청명", month: 4, day: 5, jie: true },
  { lon: 30, ko: "곡우", month: 4, day: 20, jie: false },
  { lon: 45, ko: "입하", month: 5, day: 6, jie: true },
  { lon: 60, ko: "소만", month: 5, day: 21, jie: false },
  { lon: 75, ko: "망종", month: 6, day: 6, jie: true },
  { lon: 90, ko: "하지", month: 6, day: 21, jie: false },
  { lon: 105, ko: "소서", month: 7, day: 7, jie: true },
  { lon: 120, ko: "대서", month: 7, day: 23, jie: false },
  { lon: 135, ko: "입추", month: 8, day: 7, jie: true },
  { lon: 150, ko: "처서", month: 8, day: 23, jie: false },
  { lon: 165, ko: "백로", month: 9, day: 8, jie: true },
  { lon: 180, ko: "추분", month: 9, day: 23, jie: false },
  { lon: 195, ko: "한로", month: 10, day: 8, jie: true },
  { lon: 210, ko: "상강", month: 10, day: 23, jie: false },
  { lon: 225, ko: "입동", month: 11, day: 7, jie: true },
  { lon: 240, ko: "소설", month: 11, day: 22, jie: false },
  { lon: 255, ko: "대설", month: 12, day: 7, jie: true },
  { lon: 270, ko: "동지", month: 12, day: 22, jie: false },
];

/** 중기: 엔진 getSolarTermJDE와 같은 뉴턴 반복 (초기값은 대략 날짜의 UTC 자정, 1분 정밀도) */
function midTermKstIso(year: number, t: (typeof TERMS_24)[number]): string {
  let jde = gregorianToJdn(year, t.month, t.day) - 0.5;
  for (let i = 0; i < 50; i++) {
    let delta = t.lon - sunApparentLongitude(jde);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const correction = (delta / 360) * 365.25;
    jde += correction;
    if (Math.abs(correction) < 1 / 1440) break;
  }
  return jdeToKSTIso(jde);
}

const cache = new Map<number, { ko: string; date: string }[]>();
/** 그 해의 24절기 입절일(KST 날짜), 황경 순(소한 → 동지) */
export function solarTermsOfYear(year: number): { ko: string; date: string }[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const list = TERMS_24.map((t) => ({ ko: t.ko, date: (t.jie ? getSolarTermKSTIso(year, t.lon) : midTermKstIso(year, t)).slice(0, 10) }));
  cache.set(year, list);
  return list;
}

const DAY_WORD = ["", "첫날", "이틀째", "사흘째", "나흘째", "닷새째", "엿새째", "이레째", "여드레째", "아흐레째", "열흘째", "열하루째", "열이틀째", "열사흘째", "열나흘째", "보름째", "열엿새째", "열이레째", "열여드레째"];
/** n일째를 우리말로 (1 → 첫날, 3 → 사흘째, 15 → 보름째). 표 밖이면 숫자 */
export const termDayWord = (n: number): string => DAY_WORD[n] ?? `${n}일째`;

const dayNum = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

export interface SolarTermToday {
  /** 절기 이름 (한글) */
  name: string;
  /** 그 절기의 며칠째 (입절일 = 1) */
  dayIndex: number;
  /** 입절일 당일인가 */
  isTermDay: boolean;
  /** "한로 사흘째" */
  label: string;
}

/** 그날(YYYY-MM-DD, KST)이 속한 24절기와 며칠째인지 */
export function solarTermOf(date: string): SolarTermToday {
  const y = Number(date.slice(0, 4));
  const all = [...solarTermsOfYear(y - 1), ...solarTermsOfYear(y)].filter((t) => t.date <= date);
  const cur = all[all.length - 1]!;
  const dayIndex = dayNum(date) - dayNum(cur.date) + 1;
  return { name: cur.ko, dayIndex, isTermDay: dayIndex === 1, label: `${cur.ko} ${termDayWord(dayIndex)}` };
}
