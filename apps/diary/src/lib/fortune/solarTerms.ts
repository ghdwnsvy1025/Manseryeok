// 24절기 — 운세 글의 "오늘 재료"(v4.4). 24절기 날짜 계산(12절입 + 12중기)은 엔진 solarTermsOfYear가 하고,
// 여기서는 "그날이 어느 절기 며칠째인가"와 우리말 표기만 만든다. 절입은 코어 monthGanjiList(월운 경계)와 같은 엔진 계산이다.
import { solarTermsOfYear } from "@saju/engine";

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
