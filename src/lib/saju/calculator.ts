// ============================================================
// 사주팔자 메인 계산기
// calculateSaju(input) → SajuResult | SajuError
// ============================================================

import type { SajuInput, SajuResult } from "./types";
import { kstToJDE, mod } from "./jdn";
import { getYearPillar } from "./yearPillar";
import { getMonthPillar } from "./monthPillar";
import { getDayPillar } from "./dayPillar";
import { getHourPillar } from "./hourPillar";
import { lunarToSolar } from "./lunarConverter";
import { equationOfTime } from "./solarTerms";
import { buildMajorJieSolarTermsForDaeun, calculateDaeun } from "./daeun";
import { calculateHiddenStems } from "./hiddenStems";

export function calculateSaju(input: SajuInput): SajuResult {
  const { options } = input;
  const warnings: string[] = [];

  if (!input.gender) {
    throw new Error("대운 방향 계산을 위해 성별을 선택해주세요.");
  }

  // ── 1. 양력 날짜 결정 ────────────────────────────────────
  let solarYear = input.year;
  let solarMonth = input.month;
  let solarDay = input.day;
  let lunarConversionInfo: SajuResult["input"]["lunarConversion"] | undefined;

  if (options.calendarType === "lunar") {
    const conv = lunarToSolar(
      input.year,
      input.month,
      input.day,
      options.isLeapMonth ?? false
    );
    solarYear = conv.outputSolar.year;
    solarMonth = conv.outputSolar.month;
    solarDay = conv.outputSolar.day;
    lunarConversionInfo = {
      inputLunar: `음력 ${input.year}년 ${options.isLeapMonth ? "윤" : ""}${input.month}월 ${input.day}일`,
      outputSolar: conv.outputSolarString,
    };
  }

  // ── 2. 시간 결정 ────────────────────────────────────────
  const hasTime = input.hour !== undefined && input.minute !== undefined;
  let kstHour = hasTime ? (input.hour as number) : 12; // 시간 모름: 낮 12시 기본값
  let kstMinute = hasTime ? (input.minute as number) : 0;

  if (!hasTime) {
    warnings.push("출생 시간이 없어 시주를 계산하지 않았습니다. 일주 계산에는 낮 12시(정오)를 기준으로 사용했습니다.");
  }

  // ── 3. 시간 보정 ────────────────────────────────────────
  let timeCorrectionMinutes = 0;

  if (options.timeCorrection !== "none") {
    const lon = options.location?.longitude;
    if (lon === undefined || lon === null) {
      throw new Error(
        "진태양시/평균태양시 보정을 사용하려면 출생지 경도가 필요합니다. 출생지를 입력하거나 시간 보정 옵션을 '없음'으로 설정해주세요."
      );
    }

    // 한국 표준 경선: 동경 135°
    const stdMeridian = 135;
    const lmtOffset = (lon - stdMeridian) * 4; // 분 단위

    if (options.timeCorrection === "localMeanSolarTime") {
      timeCorrectionMinutes = lmtOffset;
    } else if (options.timeCorrection === "trueSolarTime") {
      // 진태양시 = 평균태양시 + 균시차
      const approxJde = kstToJDE(solarYear, solarMonth, solarDay, kstHour, kstMinute);
      const eot = equationOfTime(approxJde);
      timeCorrectionMinutes = lmtOffset + eot;
    }

    // 보정 적용
    const totalMinutes = kstHour * 60 + kstMinute + Math.round(timeCorrectionMinutes);
    kstHour = mod(Math.floor(totalMinutes / 60), 24);
    kstMinute = mod(totalMinutes, 60);

    const corrLabel = options.timeCorrection === "localMeanSolarTime" ? "평균태양시" : "진태양시";
    warnings.push(
      `${corrLabel} 보정 적용: ${timeCorrectionMinutes >= 0 ? "+" : ""}${timeCorrectionMinutes.toFixed(1)}분`
    );
  }

  // ── 4. JDE 계산 ────────────────────────────────────────
  const birthJDE = kstToJDE(solarYear, solarMonth, solarDay, kstHour, kstMinute);

  // 정규화된 KST 날짜/시각 문자열
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const normalizedSolarDate = `${solarYear}-${pad(solarMonth)}-${pad(solarDay)}`;
  const normalizedSolarDateTime = `${normalizedSolarDate}T${pad(kstHour)}:${pad(kstMinute)}:00+09:00`;

  // ── 5. 년주 계산 ────────────────────────────────────────
  const yearResult = getYearPillar(birthJDE, solarYear);

  // ── 6. 월주 계산 ────────────────────────────────────────
  const yearStemIndex = mod(yearResult.sajuYear - 4, 10);
  const monthResult2 = getMonthPillar(birthJDE, yearResult.sajuYear, yearStemIndex);

  // ── 7. 일주 계산 ────────────────────────────────────────
  const dayResult = getDayPillar(
    solarYear,
    solarMonth,
    solarDay,
    kstHour,
    options.dayChangeRule
  );

  // ── 8. 시주 계산 ────────────────────────────────────────
  let hourPillar: SajuResult["pillars"]["hour"] = null;
  let hourBranchOrder: number | undefined;

  if (hasTime) {
    const hourResult = getHourPillar(dayResult.stemIndex, kstHour, kstMinute);
    hourPillar = hourResult.pillar;
    hourBranchOrder = hourResult.hourBranchOrder;
  }

  // ── 9. 대운 계산 ─────────────────────────────────────────
  const daeun = calculateDaeun({
    birthDateTime: normalizedSolarDateTime,
    gender: input.gender,
    pillars: {
      year: yearResult.pillar,
      month: monthResult2.pillar,
      day: dayResult.pillar,
      hour: hourPillar,
    },
    solarTerms: buildMajorJieSolarTermsForDaeun(solarYear),
  });

  // ── 10. 지장간 조회 ──────────────────────────────────────
  const hiddenStems = calculateHiddenStems({
    year: yearResult.pillar,
    month: monthResult2.pillar,
    day: dayResult.pillar,
    hour: hourPillar,
  });

  // ── 11. 결과 조립 ────────────────────────────────────────
  return {
    input: {
      original: input,
      normalizedSolarDate,
      normalizedSolarDateTime,
      timezone: options.timezone || "Asia/Seoul",
      lunarConversion: lunarConversionInfo,
    },
    options,
    pillars: {
      year: yearResult.pillar,
      month: monthResult2.pillar,
      day: dayResult.pillar,
      hour: hourPillar,
    },
    daeun,
    hiddenStems,
    debug: {
      usedLichun: yearResult.lichunKSTIso,
      usedMonthSolarTermStart: monthResult2.startTermKSTIso,
      usedMonthSolarTermEnd: monthResult2.endTermKSTIso,
      usedMonthSolarTermName: monthResult2.startTermName,
      effectiveDateForDayPillar: dayResult.effectiveDate,
      jdnForDayPillar: dayResult.jdn,
      dayGanjiIndex: dayResult.ganjiIndex,
      hourBranchOrder,
      timeCorrectionMinutes: timeCorrectionMinutes !== 0 ? timeCorrectionMinutes : undefined,
      warnings,
    },
  };
}
