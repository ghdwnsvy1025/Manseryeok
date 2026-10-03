// ============================================================
// 천간·지지·60갑자 상수
// Jean Meeus "Astronomical Algorithms" 기반 사주 계산용
// ============================================================

export const STEMS = [
  "甲", "乙", "丙", "丁", "戊",
  "己", "庚", "辛", "壬", "癸",
] as const;

export const STEMS_KO = [
  "갑", "을", "병", "정", "무",
  "기", "경", "신", "임", "계",
] as const;

export const BRANCHES = [
  "子", "丑", "寅", "卯", "辰", "巳",
  "午", "未", "申", "酉", "戌", "亥",
] as const;

export const BRANCHES_KO = [
  "자", "축", "인", "묘", "진", "사",
  "오", "미", "신", "유", "술", "해",
] as const;

export const GANJI_60 = [
  "甲子","乙丑","丙寅","丁卯","戊辰","己巳","庚午","辛未","壬申","癸酉",
  "甲戌","乙亥","丙子","丁丑","戊寅","己卯","庚辰","辛巳","壬午","癸未",
  "甲申","乙酉","丙戌","丁亥","戊子","己丑","庚寅","辛卯","壬辰","癸巳",
  "甲午","乙未","丙申","丁酉","戊戌","己亥","庚子","辛丑","壬寅","癸卯",
  "甲辰","乙巳","丙午","丁未","戊申","己酉","庚戌","辛亥","壬子","癸丑",
  "甲寅","乙卯","丙辰","丁巳","戊午","己未","庚申","辛酉","壬戌","癸亥",
] as const;

export type Element = "wood" | "fire" | "earth" | "metal" | "water";
export type YinYang = "yang" | "yin";

export const STEM_META: Record<
  string,
  { ko: string; yinYang: YinYang; element: Element }
> = {
  甲: { ko: "갑", yinYang: "yang", element: "wood"  },
  乙: { ko: "을", yinYang: "yin",  element: "wood"  },
  丙: { ko: "병", yinYang: "yang", element: "fire"  },
  丁: { ko: "정", yinYang: "yin",  element: "fire"  },
  戊: { ko: "무", yinYang: "yang", element: "earth" },
  己: { ko: "기", yinYang: "yin",  element: "earth" },
  庚: { ko: "경", yinYang: "yang", element: "metal" },
  辛: { ko: "신", yinYang: "yin",  element: "metal" },
  壬: { ko: "임", yinYang: "yang", element: "water" },
  癸: { ko: "계", yinYang: "yin",  element: "water" },
};

export const BRANCH_META: Record<
  string,
  { ko: string; zodiacKo: string; yinYang: YinYang; element: Element }
> = {
  子: { ko: "자", zodiacKo: "쥐",    yinYang: "yang", element: "water" },
  丑: { ko: "축", zodiacKo: "소",    yinYang: "yin",  element: "earth" },
  寅: { ko: "인", zodiacKo: "호랑이", yinYang: "yang", element: "wood"  },
  卯: { ko: "묘", zodiacKo: "토끼",  yinYang: "yin",  element: "wood"  },
  辰: { ko: "진", zodiacKo: "용",    yinYang: "yang", element: "earth" },
  巳: { ko: "사", zodiacKo: "뱀",    yinYang: "yin",  element: "fire"  },
  午: { ko: "오", zodiacKo: "말",    yinYang: "yang", element: "fire"  },
  未: { ko: "미", zodiacKo: "양",    yinYang: "yin",  element: "earth" },
  申: { ko: "신", zodiacKo: "원숭이", yinYang: "yang", element: "metal" },
  酉: { ko: "유", zodiacKo: "닭",    yinYang: "yin",  element: "metal" },
  戌: { ko: "술", zodiacKo: "개",    yinYang: "yang", element: "earth" },
  亥: { ko: "해", zodiacKo: "돼지",  yinYang: "yin",  element: "water" },
};

// 사주 월주 계산에 사용하는 12개 절입 경계 (순서: 寅월=1 ~ 丑월=12)
export const MONTH_SOLAR_TERM_LONGITUDES = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285] as const;

// 월번호(1=寅)에 해당하는 지지 인덱스 (BRANCHES 기준)
export const MONTH_BRANCH_INDICES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1] as const;
// 寅=2, 卯=3, 辰=4, 巳=5, 午=6, 未=7, 申=8, 酉=9, 戌=10, 亥=11, 子=0, 丑=1

export const ELEMENT_LABELS: Record<Element, string> = {
  wood:  "木",
  fire:  "火",
  earth: "土",
  metal: "金",
  water: "水",
};
