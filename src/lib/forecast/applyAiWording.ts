import type { DailyForecast } from "./types";
import type { ForecastAiOutput } from "./aiSchema";
import { FORECAST_MODEL_VERSION } from "./types";

export function applyAiWording(
  forecast: DailyForecast,
  ai: ForecastAiOutput
): DailyForecast {
  return {
    ...forecast,
    todaySummary: ai.todaySummary,
    innerSignal: { text: ai.possibleInnerSignal, isHypothesis: true },
    neededCondition: {
      ...forecast.neededCondition,
      text: ai.neededCondition,
    },
    emotionForecast: {
      ...forecast.emotionForecast,
      forecast: ai.emotionForecast,
    },
    focusForecast: {
      ...forecast.focusForecast,
      forecast: ai.focusForecast,
    },
    conditionForecast: {
      ...forecast.conditionForecast,
      forecast: ai.conditionForecast,
    },
    oneAction: {
      ...forecast.oneAction,
      action: ai.oneAction,
    },
    reflectionSentence: ai.reflectionSentence,
    generationMode: "ai_assisted",
    modelVersion: `${FORECAST_MODEL_VERSION}+ai`,
    updatedAt: new Date().toISOString(),
  };
}
