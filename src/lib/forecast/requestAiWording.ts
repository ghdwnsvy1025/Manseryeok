import type { DiaryEntry } from "@/lib/diary/types";
import { ENERGY_RATING_LABELS, type EnergyRating } from "@/lib/diary/types";
import { HAPPINESS_RATING_LABELS } from "@/lib/diary/happiness";
import type { DailyForecast } from "./types";
import type { ForecastAiInput, ForecastAiOutput } from "./aiSchema";
import { averageEnergy, averageHappiness, topTags } from "./similarDays";
import { findSimilarDays } from "./similarDays";

export function buildForecastAiInput(input: {
  forecast: DailyForecast;
  todayEntry: DiaryEntry;
  entries: DiaryEntry[];
  languageLevel?: "beginner" | "expert";
}): ForecastAiInput {
  const { forecast, todayEntry } = input;
  const facts = forecast.traditionalFacts;
  const similar = findSimilarDays({
    entries: input.entries,
    targetGanjiKo: facts.ganjiKo,
    targetStemKo: facts.heavenlyStem,
    targetBranchKo: facts.earthlyBranch,
    targetTenGod: facts.tenGod,
    excludeDate: todayEntry.date,
  });

  const mood =
    todayEntry.happinessRating != null
      ? HAPPINESS_RATING_LABELS[todayEntry.happinessRating]
      : null;
  const energy =
    todayEntry.energyRating != null
      ? ENERGY_RATING_LABELS[todayEntry.energyRating as EnergyRating]
      : null;

  return {
    targetDate: forecast.targetDate,
    languageLevel: input.languageLevel ?? "beginner",
    tomorrowSaju: {
      dayGanjiKo: facts.ganjiKo,
      heavenlyStem: facts.heavenlyStem,
      earthlyBranch: facts.earthlyBranch,
      tenGod: facts.tenGod,
      relationLabels: facts.relations.map((r) => r.label),
    },
    recentState: {
      summary: forecast.recentStateSummary,
      moodAvg: null,
      energyAvg: null,
    },
    similarDayStatistics: {
      sampleSizes: forecast.sampleSizes,
      moodAverage: averageHappiness(similar.primaryEntries),
      energyAverage: averageEnergy(similar.primaryEntries),
      frequentTags: topTags(similar.primaryEntries, 5),
    },
    todayStructured: {
      moodLabel: mood,
      energyLabel: energy,
      primaryArea: todayEntry.primaryArea ?? null,
      emotions: todayEntry.emotions ?? [],
      tags: todayEntry.tags ?? [],
    },
    localDraft: {
      todaySummary: forecast.todaySummary,
      innerSignal: forecast.innerSignal.text,
      neededCondition: forecast.neededCondition.text,
      emotionForecast: forecast.emotionForecast.forecast,
      focusForecast: forecast.focusForecast.forecast,
      conditionForecast: forecast.conditionForecast.forecast,
      oneAction: forecast.oneAction.action,
      reflectionSentence: forecast.reflectionSentence,
    },
    dataMaturity: forecast.maturity,
  };
}

export async function requestAiWording(
  aiInput: ForecastAiInput
): Promise<ForecastAiOutput | null> {
  try {
    const res = await fetch("/api/forecast/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiInput),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { wording?: ForecastAiOutput };
    return data.wording ?? null;
  } catch {
    return null;
  }
}
