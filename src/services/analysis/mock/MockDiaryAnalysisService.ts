import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { getUniqueEntryDays } from "@/lib/diary/stats";
import { buildLocalNightReport } from "@/lib/forecast/buildLocalNightReport";
import {
  resolvePersonalizationLevel,
  PERSONALIZATION_SUMMARIES,
} from "@/lib/product/personalization";
import { prefersPlainLanguage } from "@/lib/product/modes";
import type {
  DiaryAnalysisService,
  DiaryAnalysisInput,
  DiaryAnalysisResult,
} from "../types";

const ACTION_CANDIDATES = [
  {
    action: "내일 반드시 끝낼 일 한 가지를 미리 정해보세요.",
    reason: "할 일이 명확할수록 집중이 이어지기 쉬운 흐름이에요.",
  },
  {
    action: "저녁에 짧은 회복 시간을 미리 비워두세요.",
    reason: "피로가 빠르게 쌓일 수 있어 여백이 도움이 될 수 있어요.",
  },
  {
    action: "오늘 마음에 남은 장면을 한 문장으로만 적어보세요.",
    reason: "감정을 짧게 정리하면 다음날 흐름을 보기 쉬워져요.",
  },
];

const REFLECTIONS = [
  "모든 것을 혼자 감당하는 것이 책임감의 증거는 아닙니다.",
  "오늘의 컨디션은 내일의 계획을 조금 줄여도 된다는 신호일 수 있어요.",
  "관계는 의도가 분명할 때 더 가볍게 흘러갈 수 있어요.",
];

export class MockDiaryAnalysisService implements DiaryAnalysisService {
  async analyzeDiary(input: DiaryAnalysisInput): Promise<DiaryAnalysisResult> {
    const real = filterRealEntries(input.entries);
    const count = getUniqueEntryDays(real);
    const personalization = resolvePersonalizationLevel(count);
    const plain = prefersPlainLanguage(input.mode);
    const action =
      ACTION_CANDIDATES[count % ACTION_CANDIDATES.length] ?? ACTION_CANDIDATES[0];
    const reflection =
      REFLECTIONS[count % REFLECTIONS.length] ?? REFLECTIONS[0];

    const happiness = input.entry.happinessRating;
    const energy = input.entry.energyRating;

    let mindSummary = "오늘 기록이 저장됐어요. 하루의 흐름을 천천히 돌아볼 수 있어요.";
    if (happiness != null && happiness >= 4) {
      mindSummary = plain
        ? "오늘은 비교적 가벼운 기분이 남아 있는 하루로 보여요."
        : "오늘은 기운이 바깥으로 잘 흐른 하루로 읽혀요.";
    } else if (happiness != null && happiness <= 2) {
      mindSummary = plain
        ? "오늘은 마음이 무겁게 느껴진 장면이 있었을 수 있어요."
        : "오늘은 기운이 안으로 모이거나 부담이 커진 하루로 읽혀요.";
    }

    return {
      state: "ready",
      mindSummary,
      hiddenSignal: {
        text:
          "아직 AI 분석 기능을 준비하고 있어요. 기록은 정상적으로 저장되었으며, 앞으로 이 영역에서 신호 분석을 확인할 수 있습니다.",
        isHypothesis: true,
        aiConnected: false,
      },
      neededCondition:
        energy != null && energy <= 2
          ? "혼자 회복할 짧은 시간이 필요할 수 있어요."
          : "일정에 작은 여백이 있으면 더 편할 수 있어요.",
      oneAction: action,
      reflection: { text: reflection, source: "generated" },
      personalization,
      recordCount: count,
      feedbackPrompt: ["agree", "partly_agree", "disagree", "unsure"],
    };
  }
}
