import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { buildLocalNightReport } from "@/lib/forecast/buildLocalNightReport";
import type {
  ForecastService,
  ForecastInput,
  ForecastResult,
} from "../types";

const MIN_PRIMARY_SAMPLES = 2;

export class MockForecastService implements ForecastService {
  async createForecast(input: ForecastInput): Promise<ForecastResult> {
    if (!input.todayEntry) {
      return {
        state: "no_today_entry",
        forecast: null,
        message: "오늘을 기록하면 내일의 개인 예보를 만들 수 있어요.",
      };
    }

    try {
      const real = filterRealEntries(input.entries);
      const { forecast } = buildLocalNightReport({
        todayEntry: input.todayEntry,
        entries: real,
        sajuProfile: input.sajuProfile,
      });

      const sampleTotal =
        forecast.sampleSizes.ganji +
        forecast.sampleSizes.tenGod +
        forecast.sampleSizes.stem +
        forecast.sampleSizes.branch;

      if (sampleTotal < MIN_PRIMARY_SAMPLES) {
        return {
          state: "insufficient_data",
          forecast,
          message:
            "아직 비슷한 날 기록이 적어 기본 사주 흐름을 중심으로 보여드려요.",
        };
      }

      return { state: "ready", forecast };
    } catch (err) {
      return {
        state: "error",
        forecast: null,
        message:
          err instanceof Error ? err.message : "예보를 만들지 못했어요.",
      };
    }
  }
}
