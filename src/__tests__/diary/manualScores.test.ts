import { describe, expect, test } from "@jest/globals";
import { computeDailyWellbeing } from "@/lib/diary/dimensions";
import {
  createManualScoreState,
  createManualScoreStateFromWellbeing,
  manualStateToAnalysis,
  wellbeingToAnalysis,
  wellbeingToEmotionLabel,
} from "@/lib/diary/manualScores";

describe("manual scores wellbeing", () => {
  test("세부 점수로부터 종합 행복도 계산", () => {
    const state = createManualScoreState();
    const analysis = manualStateToAnalysis(state);
    expect(analysis.daily_wellbeing_score).toBe(computeDailyWellbeing(analysis));
  });

  test("행복도만으로 분석 생성", () => {
    const analysis = wellbeingToAnalysis(72, "positive");
    expect(analysis.daily_wellbeing_score).toBe(72);
    expect(analysis.emotion_label).toBe("positive");
    expect(analysis.summary).toContain("72");
  });

  test("현재 행복도로 세부 조절 상태를 만들면 종합 행복도를 유지", () => {
    const state = createManualScoreStateFromWellbeing(67);
    expect(manualStateToAnalysis(state).daily_wellbeing_score).toBe(67);
  });
});

describe("wellbeingToEmotionLabel", () => {
  test("행복도 구간별 감정 라벨", () => {
    expect(wellbeingToEmotionLabel(85)).toBe("very_positive");
    expect(wellbeingToEmotionLabel(65)).toBe("positive");
    expect(wellbeingToEmotionLabel(50)).toBe("neutral");
    expect(wellbeingToEmotionLabel(30)).toBe("negative");
    expect(wellbeingToEmotionLabel(10)).toBe("very_negative");
  });
});

describe("manualStateToAnalysis", () => {
  test("슬라이더 상태를 DiaryAnalysis로 변환", () => {
    const analysis = manualStateToAnalysis(createManualScoreState());
    expect(analysis.summary).toContain("오늘의 행복도는");
    expect(analysis.confidence).toBe(100);
    expect(analysis.psychological_analysis).toBeNull();
  });
});
