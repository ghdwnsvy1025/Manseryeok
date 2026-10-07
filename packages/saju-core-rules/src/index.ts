// @saju/core-rules — 사주 코어 판정 함수의 복사본 진입점. 원본은 사주 코어 core/src (README 참고).
// 1단계(이식)만 들어 있다. 운세 조립·글 생성은 여기 두지 않는다.
export type { Pillars, Element, Group, TenGod, Role } from "./base";
export { parsePillars, checkPillars, toKo } from "./base";

export type { Balance, Yongsin, Luck, LuckPart, LuckVerdict, YongsinMethod } from "./yongsin";
export { balance, yongsin, luck, unknownHour } from "./yongsin";

export type { Relations } from "./relations";
export { relations, luckRelations, luckClash } from "./relations";

export type { Gyeok } from "./gyeokguk";
export { gyeokguk, gyeokInLuck } from "./gyeokguk";

export type { Johu } from "./extras";
export { johu, extraTags } from "./extras";

// Y-12 쓰는 기운 · K-09 T존 조합 (코어 240c91d, 2026-10-07) · 이론 버전
export type { Usable, UsableItem, TzoneCombo } from "./usable";
export { usable, tzoneCombo } from "./usable";
export { THEORY_VERSION } from "./version";

export type { Options as AreaOptions } from "./areas";
export { areas, luckAreas } from "./areas";

export { luckKeywords, areaKeywords } from "./keywords";

export type { BirthInput, BirthResult, DaeunItem } from "./birth";
export { fromBirth, yearGanji, monthGanjiList } from "./birth";

// 어댑터 (원본 아님 — 일기 앱과 코어 사이의 얇은 변환)
export { toCorePillars } from "./adapters/pillars";
export { currentLuckContext, type LuckContext } from "./adapters/luckContext";
