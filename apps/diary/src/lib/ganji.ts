import { getDayPillar } from "@saju/engine";
import { parseYmd } from "./time";

export interface DayGanji {
  /** 60갑자 순번. 甲子 = 0 */
  index: number;
  ko: string; // "경술"
  hanja: string; // "庚戌"
  stemKo: string;
  branchKo: string;
}

/**
 * 날짜의 일진. 일주는 날짜만으로 정해지므로 정오 기준으로 계산한다
 * (레거시와 같은 자정 일 바뀜 규칙).
 */
export function dayGanji(ymd: string): DayGanji {
  const p = parseYmd(ymd);
  if (!p) throw new Error(`잘못된 날짜: ${ymd}`);
  const r = getDayPillar(p.year, p.month, p.day, 12, "midnight");
  return {
    index: r.ganjiIndex,
    ko: r.pillar.ganjiKo,
    hanja: r.pillar.ganji,
    stemKo: r.pillar.stem.ko,
    branchKo: r.pillar.branch.ko,
  };
}
