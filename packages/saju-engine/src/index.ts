// @saju/engine — 공용 진입점. 세부 함수는 "@saju/engine/<모듈>"로도 가져올 수 있다.
export * from "./calculator";
export * from "./constants";
export * from "./types";
export * from "./dayPillar";
export * from "./monthPillar";
export * from "./yearPillar";
export * from "./hourPillar";
export * from "./jdn";
export * from "./solarTerms";
export * from "./lunarConverter";
export * from "./hiddenStems";
export * from "./daeun";
export * from "./elementDistribution";
export * from "./yongsin";
export * from "./tenGodPlain";

// 엔진 버전. 사주 프로필 스냅샷에 함께 저장해 계산 기준이 바뀌면 다시 계산할 수 있게 한다.
// 계산 결과가 바뀌는 커밋은 이 값을 올리고 test/engineVersion.test.ts에 새 지문 줄을 더한다.
// 엔진 코드가 그대로여도 앱의 원국 기준(apps/diary computeProfile)이 바뀌면 올린다. 그 변경은 지문 시험이 잡아 주지 않는다.
export const ENGINE_VERSION = "1.2.0";
