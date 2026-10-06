// 원본 아님 — 사주 코어 core/src/reading.ts readFromPillars() 의 "---- 6. 운 ----" 부분(37·52~56행 @ ebf972d)에서
// "기준일로 현재 대운·세운 고르기"만 떼어 독립 함수로 만든 어댑터. 고르는 규칙은 reading.ts 와 글자까지 같게 유지한다:
//   - 현재 대운 = 시작일 ≤ 기준일 < 끝일 인 항목. 첫 대운 전이면 순서 0, 간지는 월주 (기준.md 5번)
//   - 세운 연도 = 기준일의 양력 연도 그대로 (reading.ts 와 같음. 입춘 전 1~2월은 이전 해 간지가 맞을 수 있다 — 호출 쪽에서 판단)
//   - 월운 = monthGanjiList(기준일, 12) 의 첫 항목 (절입 기준이라 "이 달"은 양력 달과 어긋날 수 있음)
// 유불리 판정(luck 등)은 하지 않는다. 그것은 호출 쪽(다음 단계)의 일.
import type { BirthResult } from "../birth";
import { monthGanjiList, yearGanji } from "../birth";

export type LuckContext = {
  기준일: string;
  현재대운: { 순서: number; 간지: string; 다음전환: string | null; 메모?: string } | null;
  세운: { 해: number; 간지: string }[];      // [올해, 내년]
  월운: { 사주연도: number; 월번호: number; 시작: string; 끝: string; 간지: string } | null;
};

/** 생년월일 계산 결과와 기준일(YYYY-MM-DD)로 지금 어느 대운·세운·월운 안에 있는지 고른다 */
export function currentLuckContext(birth: Pick<BirthResult, "pillars" | "대운">, 기준일: string): LuckContext {
  const today = 기준일; const thisYear = Number(today.slice(0, 4));
  const list = birth.대운.목록;
  const cur = list.find((c) => c.시작일 && c.끝일 && today >= c.시작일.slice(0, 10) && today < c.끝일.slice(0, 10)) ?? null;
  const before = !cur && list[0]?.시작일 && today < list[0].시작일.slice(0, 10);
  const 현재대운 = cur ? { 순서: cur.순서, 간지: cur.간지, 다음전환: cur.끝일 }
    : before ? { 순서: 0, 간지: birth.pillars[1], 다음전환: list[0].시작일, 메모: "첫 대운 전 → 태어난 달의 월주를 대운으로 봄 (기준.md 5번)" } : null;
  const 세운 = [thisYear, thisYear + 1].map((yr) => ({ 해: yr, 간지: yearGanji(yr) }));
  const 월운 = monthGanjiList(today, 1)[0] ?? null;
  return { 기준일: today, 현재대운, 세운, 월운 };
}
