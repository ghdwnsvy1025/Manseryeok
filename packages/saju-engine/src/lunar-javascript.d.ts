// lunar-javascript type declarations
declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): Lunar;
    toString(): string;
  }
  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getYear(): number;
    /** 윤달은 음수 (예: 윤2월 = -2). isLeap()은 존재하지 않는다. */
    getMonth(): number;
    getDay(): number;
    getSolar(): Solar;
    toString(): string;
  }
  /** 寿星万年历 천문 계산. 절입 시각에 쓴다 */
  export const ShouXingUtil: {
    /** 누적 태양 황경 w(라디안)에 도달하는 시각. J2000 기준 일수, 베이징 시각(UT+8h) */
    qiAccurate(w: number): number;
  };
}
