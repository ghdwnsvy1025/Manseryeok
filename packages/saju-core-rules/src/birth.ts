// 원본: 사주 코어 core/src/birth.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). 판정 로직 수정 금지 — 바꾸려면 코어에서 먼저 바꾸고 다시 복사.
// 기준.md 2~5번 — 생년월일시 → 8글자·대운. 만세력 계산은 vendor/manseryeok(앱 엔진 복사본)에 맡기고,
// 이 파일은 엔진에 없는 것만 합니다: 서머타임, 동경 127.5° 표준시 기간, 출생지 경도 보정(날짜 넘김 포함).
import { calculateSaju } from "@saju/engine";   // [이식] vendor/manseryeok → @saju/engine (같은 시그니처)
import { lunarToSolar } from "@saju/engine";     // [이식] vendor/manseryeok → @saju/engine
import { getSolarTermKSTIso } from "@saju/engine"; // [이식] vendor/manseryeok → @saju/engine
import type { Pillars } from "./base";

export type BirthInput = {
  year: number; month: number; day: number;
  hour?: number; minute?: number;                 // 모르면 비움
  달력?: "양력" | "음력"; 윤달?: boolean;
  성별: "남" | "여";
  출생지?: string;                                 // 시·도 이름 (기본 서울)
  경도?: number;                                   // 직접 주면 출생지보다 우선
};

/** 시·도청 소재지 기준 경도(근삿값). 같은 시·도 안에서도 ±0.5°(약 2분) 차이가 납니다 */
export const LONGITUDE: Record<string, number> = {
  서울: 126.98, 부산: 129.08, 대구: 128.6, 인천: 126.71, 광주: 126.85, 대전: 127.38, 울산: 129.31, 세종: 127.29,
  경기: 127.01, 강원: 127.73, 충북: 127.49, 충남: 126.67, 전북: 127.15, 전남: 126.46, 경북: 128.73, 경남: 128.68, 제주: 126.53,
};

const T = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);   // "시계 시각"을 그대로 숫자로 (시간대 계산 아님)
const DST: [number, number][] = [
  [T(1948, 6, 1), T(1948, 9, 13)], [T(1949, 4, 3), T(1949, 9, 11)], [T(1950, 4, 1), T(1950, 9, 10)], [T(1951, 5, 6), T(1951, 9, 9)],
  [T(1955, 5, 5), T(1955, 9, 9)], [T(1956, 5, 20), T(1956, 9, 30)], [T(1957, 5, 5), T(1957, 9, 22)], [T(1958, 5, 4), T(1958, 9, 21)],
  [T(1959, 5, 3), T(1959, 9, 20)], [T(1960, 5, 1), T(1960, 9, 18)], [T(1987, 5, 10, 2), T(1987, 10, 11, 3)], [T(1988, 5, 8, 2), T(1988, 10, 9, 3)],
]; // [노트 입문 6강 표]. 1948~1960년은 시작·끝 시각이 표에 없어 날짜 단위(시작일 0시 ~ 끝일 24시)로 처리
const M1275: [number, number][] = [[T(1908, 2, 1), T(1912, 1, 1)], [T(1954, 3, 21), T(1961, 8, 10)]];
const inRange = (t: number, rs: [number, number][], endInclusiveDay = false) => rs.some(([a, b]) => t >= a && t < b + (endInclusiveDay ? 86400000 : 0));
const parts = (t: number) => { const d = new Date(t); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }; };
const fmt = (t: number) => { const x = parts(t); const z = (n: number) => String(n).padStart(2, "0"); return `${x.year}-${z(x.month)}-${z(x.day)} ${z(x.hour)}:${z(x.minute)}`; };

export type DaeunItem = { 순서: number; 간지: string; 시작나이: number; 끝나이: number; 시작일: string | null; 끝일: string | null };
export type BirthResult = {
  pillars: Pillars; 시간모름: boolean; 양력: string;
  보정: { 시계시각: string | null; 서머타임: boolean; 표준시1275: boolean; 경도: number; 경도보정분: number; 실제KST: string | null; 보정시각: string | null };
  대운: { 방향: "순행" | "역행"; 시작나이: { 년: number; 월: number }; 목록: DaeunItem[] };
  경고: string[];
  엔진분포: { 원국퍼센트: Record<string, number> | null };
};

export function fromBirth(input: BirthInput): BirthResult {
  const 경고: string[] = []; let { year, month, day } = input;
  if ((input.달력 ?? "양력") === "음력") { const c = lunarToSolar(year, month, day, input.윤달 ?? false); ({ year, month, day } = c.outputSolar); }
  const lon = input.경도 ?? LONGITUDE[input.출생지 ?? "서울"];
  if (lon === undefined) throw new Error(`출생지 '${input.출생지}'을(를) 모릅니다. 가능한 값: ${Object.keys(LONGITUDE).join(", ")}`);
  const gender = input.성별 === "남" ? "male" : "female";
  const base = { calendarType: "solar" as const, timezone: "Asia/Seoul", dayChangeRule: "ziHour" as const, timeCorrection: "none" as const };
  const hasTime = input.hour !== undefined;
  const call = (t: number | null) => { const x = t === null ? { year, month, day } : parts(t); return calculateSaju({ year: x.year, month: x.month, day: x.day, ...(t === null ? {} : { hour: parts(t).hour, minute: parts(t).minute }), gender, options: base } as any) as any; };

  let 서머타임 = false, 표준시1275 = false, 경도보정분 = 0, clock: number | null = null, kst: number | null = null, lmt: number | null = null;
  let ym: any, dh: any;
  if (hasTime) {
    clock = T(year, month, day, input.hour!, input.minute ?? 0);
    서머타임 = inRange(clock, DST.slice(0, 10), true) || inRange(clock, DST.slice(10));
    const std = clock - (서머타임 ? 3600000 : 0);                                  // 서머타임을 걷어 낸 표준시
    표준시1275 = inRange(std, M1275);
    kst = std + (표준시1275 ? 1800000 : 0);                                         // 동경 135° 기준 시각 = 실제 순간 (절입 비교용)
    경도보정분 = (lon - 135) * 4; lmt = kst + Math.round(경도보정분) * 60000;       // 출생지 평균태양시 (일주·시주용). 균시차는 적용 안 함
    ym = call(kst); dh = call(lmt);
    if (서머타임) 경고.push("서머타임 기간 출생 → 시계 시각에서 1시간을 뺐습니다");
    if (표준시1275) 경고.push("동경 127.5° 표준시 기간 출생 → 그 기준으로 경도 보정을 했습니다");
    const hm = input.hour! * 60 + (input.minute ?? 0); if (hm >= 23 * 60 + 30 || hm < 90) 경고.push("23:30~01:30 출생 → 자시 기준이 다른 만세력과는 일주가 다를 수 있습니다");
    const near = [ym.debug.usedMonthSolarTermStart, ym.debug.usedMonthSolarTermEnd].map((s: string) => Math.abs(Date.parse(s) - Date.parse(ym.input.normalizedSolarDateTime)) / 60000);
    if (Math.min(...near) <= 60) 경고.push("절입 시각 1시간 이내 출생 → 월주(입춘이면 연주)가 분 단위 오차에 민감합니다");
  } else { ym = dh = call(null); 경고.push("출생 시간 모름 → 시주 없이 계산, 일주는 정오 기준"); }

  const pillars: Pillars = [ym.pillars.year.ganji, ym.pillars.month.ganji, dh.pillars.day.ganji, hasTime ? dh.pillars.hour.ganji : null];
  const d = ym.daeun;
  return {
    pillars, 시간모름: !hasTime, 양력: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    보정: { 시계시각: clock === null ? null : fmt(clock), 서머타임, 표준시1275, 경도: lon, 경도보정분: Math.round(경도보정분 * 10) / 10, 실제KST: kst === null ? null : fmt(kst), 보정시각: lmt === null ? null : fmt(lmt) },
    대운: { 방향: d.directionText, 시작나이: { 년: d.startAge.years, 월: d.startAge.months },
      목록: d.cycles.map((c: any) => ({ 순서: c.order, 간지: c.ganji, 시작나이: Math.round(c.startAgeDecimal * 10) / 10, 끝나이: Math.round(c.endAgeDecimal * 10) / 10, 시작일: c.estimatedStartDate, 끝일: c.estimatedEndDate })) },
    경고, 엔진분포: { 원국퍼센트: dh.elementDistribution?.originalPercentage ?? null },
  };
}

/** 그 해의 세운 간지 (입춘 이후 기준의 해) */
export const yearGanji = (y: number): string => "甲乙丙丁戊己庚辛壬癸"[(y - 4) % 10] + "子丑寅卯辰巳午未申酉戌亥"[(y - 4) % 12];

/**
 * 월운 간지 목록 (Y-11) — 기준일이 든 달부터 `count`개월.
 * 달은 양력 1일이 아니라 절입(입춘·경칩·청명…)에 바뀝니다. 그래서 "3월"이 아니라 "3월 5일 무렵 ~ 4월 4일 무렵"처럼 구간으로 냅니다.
 * 월간은 그 해(입춘 기준) 연간에서 정해짐: 寅월 천간 = (연간 % 5) × 2 + 2 (monthPillar.ts와 같은 식).
 */
export function monthGanjiList(fromIso: string, count = 12): { 사주연도: number; 월번호: number; 시작: string; 끝: string; 간지: string }[] {
  const S = "甲乙丙丁戊己庚辛壬癸", B = "子丑寅卯辰巳午未申酉戌亥";
  const LON = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255];              // 입춘 ~ 대설 (그 해), 소한·다음 입춘은 다음 해
  const y0 = Number(fromIso.slice(0, 4)); const all: { 사주연도: number; 월번호: number; 시작: string; 끝: string; 간지: string }[] = [];
  for (let Y = y0 - 1; Y <= y0 + 2; Y++) {
    const edge = [...LON.map((l) => getSolarTermKSTIso(Y, l)), getSolarTermKSTIso(Y + 1, 285), getSolarTermKSTIso(Y + 1, 315)];
    const first = (((((Y - 4) % 10) + 10) % 10) % 5) * 2 + 2;
    for (let m = 1; m <= 12; m++) all.push({ 사주연도: Y, 월번호: m, 시작: edge[m - 1], 끝: edge[m], 간지: S[(first + m - 1) % 10] + B[(2 + m - 1) % 12] });
  }
  const i = all.findIndex((x) => fromIso >= x.시작.slice(0, 10) && fromIso < x.끝.slice(0, 10));
  return all.slice(Math.max(0, i), Math.max(0, i) + count);
}
