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
}
