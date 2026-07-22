import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { getUniqueEntryDays } from "@/lib/diary/stats";
import {
  resolvePersonalizationLevel,
  PERSONALIZATION_SUMMARIES,
} from "@/lib/product/personalization";
import type {
  PatternInsightService,
  PatternSummaryInput,
  PatternSummaryResult,
} from "../types";

export class MockPatternInsightService implements PatternInsightService {
  async createPatternSummary(
    input: PatternSummaryInput
  ): Promise<PatternSummaryResult> {
    const real = filterRealEntries(input.entries);
    const totalDays = getUniqueEntryDays(real);
    if (totalDays === 0) {
      return {
        state: "empty",
        totalDays: 0,
        monthDays: 0,
        avgHappiness: null,
        avgEnergy: null,
        topEmotion: null,
        topArea: null,
        personalization: "base",
        summary: "아직 기록이 없어요. 오늘의 기분부터 가볍게 남겨보세요.",
      };
    }

    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthEntries = real.filter((e) => e.date.startsWith(ym));
    const happinessVals = real
      .map((e) => e.happinessRating)
      .filter((v): v is NonNullable<typeof v> => v != null);
    const energyVals = real
      .map((e) => e.energyRating)
      .filter((v): v is NonNullable<typeof v> => v != null);

    const emotionCounts = new Map<string, number>();
    const areaCounts = new Map<string, number>();
    for (const e of real) {
      for (const emo of e.emotions ?? []) {
        emotionCounts.set(emo, (emotionCounts.get(emo) ?? 0) + 1);
      }
      if (e.primaryArea) {
        areaCounts.set(e.primaryArea, (areaCounts.get(e.primaryArea) ?? 0) + 1);
      }
    }

    const topEmotion =
      Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topArea =
      Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const personalization = resolvePersonalizationLevel(totalDays);
    const avgHappiness =
      happinessVals.length > 0
        ? happinessVals.reduce((a, b) => a + b, 0) / happinessVals.length
        : null;
    const avgEnergy =
      energyVals.length > 0
        ? energyVals.reduce((a, b) => a + b, 0) / energyVals.length
        : null;

    return {
      state: totalDays < 7 ? "insufficient_data" : "ready",
      totalDays,
      monthDays: getUniqueEntryDays(monthEntries),
      avgHappiness,
      avgEnergy,
      topEmotion,
      topArea,
      personalization,
      summary: PERSONALIZATION_SUMMARIES[personalization],
    };
  }
}
