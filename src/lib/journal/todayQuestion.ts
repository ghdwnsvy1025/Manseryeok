/**
 * 오늘의 질문 — 문장화 레이어
 * 결정은 questionDecision에서 끝남. 여기서 RAG는 말투만 다듬는다.
 */
import OpenAI from "openai";
import type { BTheme } from "./bTheme";
import type { CategoryCode } from "./types";
import type { OpenAiCallStatus } from "./openaiStatus";
import {
  loadTheoryContext,
  theoryUsageRules,
  type TheoryEvidence,
} from "./theoryContext";
import type { QuestionDecision } from "./questionDecision";
import { buildQuestionTemplate } from "./todayQuestionTemplate";
import { isRagQuestionWordingEnabled } from "@/lib/app/featureFlags";
import {
  mixRatioPayload,
  resolveGatedBlend,
} from "./insight/recordReflectGate";
import type { FortuneQuestionContext } from "./weekThemeSummary";
import type { SajuWordingHints } from "./sajuWordingHints";

export type TodayQuestionResult = {
  question: string;
  focusCategory: CategoryCode | null;
  contentScore: number | null;
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: TheoryEvidence[];
  /** 문장화 전에 확정된 결정 (RAG가 바꾸지 않음) */
  decisionLocked: true;
};

export { buildQuestionTemplate };

export async function generateTodayQuestion(opts: {
  b: BTheme;
  decision: QuestionDecision;
  ganjiKo?: string | null;
  /** false면 RAG 생략 (테스트·격리) */
  allowRagWording?: boolean;
  priorUniqueDays?: number;
  fortune?: FortuneQuestionContext | null;
  /** 프로필 사주×오늘 — 사람·날짜가 갈라지게 */
  sajuHints?: SajuWordingHints | null;
}): Promise<TodayQuestionResult> {
  const { decision } = opts;
  const fallback = decision.templateHint;
  const priorUniqueDays =
    opts.priorUniqueDays ??
    decision.evidence.priorUniqueDays ??
    0;

  // 질문은 일수 게이트 중심 (XP=0이면 cold 비중 → 일수 상한만 적용)
  const mixRatio = mixRatioPayload(
    resolveGatedBlend({
      totalXp: 0,
      priorUniqueDays,
    })
  );
  const questionMix = {
    ...mixRatio,
    sajuHypothesisWeight: decision.evidence.sajuWeight ?? mixRatio.natal,
    guideKo: `${mixRatio.guideKo} 질문 주제는 lockedDecision을 유지하고, 말투만 기록·오늘 글자 비율에 맞게 다듬으세요.`,
  };

  const allowRag =
    opts.allowRagWording !== false && isRagQuestionWordingEnabled();

  const theory = allowRag
    ? await loadTheoryContext({
        b: opts.b,
        ganjiKo: opts.ganjiKo,
        purpose: "question",
        matchCount: 5,
      })
    : {
        used: false,
        chunks: [] as string[],
        evidence: [] as TheoryEvidence[],
        detail: "rag_wording_disabled",
      };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      question: fallback,
      focusCategory: decision.focusCategory,
      contentScore: decision.contentScore,
      openAi: { kind: "skipped", detail: "no_api_key" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      decisionLocked: true,
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 일기 앱의 '오늘의 질문' 문장 담당입니다.
목적: 밤에 일기 쓰기 직전, 하루를 조용히 돌아보게 하는 감성적인 한 문장 질문.
- 한 문장 질문만 만듭니다. 설명·조언·리스트 금지.
- 주제는 primaryTheme 하나만. 키워드를 "와/과/·"로 묶지 마세요. (예: "집중과 성장" 금지)
- focusCategory와 primaryTheme가 어색하면 focusCategory의 쉬운 말만 따르세요.
- 「~를 위해」「작은 결정」「어떤 결정」「내릴 수 있었을까」처럼 전제·목적이 이미 깔린 표현 금지.
- 「있었나요?」「어땠나요?」「무엇이었나요?」「했나요?」처럼 열린 과거 회고로 끝내세요.
- lockedDecision의 포커스·primaryTheme를 바꾸지 마세요.
- sajuHints가 있으면 그 사람의 결·오늘 촉발을 톤에만 녹이세요. 다른 사주에 그대로 옮겨도 되는 질문은 실패입니다.
- todayFortune·weekTheme의 결은 감성적으로만 스며들게 하세요. 본문을 그대로 옮기지 마세요.
- 운세·사주 전문용어 금지. "진단"처럼 단정하지 마세요.
- mixRatio·pillarInfluence(off면 해당 통계 무시)를 따르세요.
${allowRag ? theoryUsageRules("question") : "- theoryChunks 없음. 템플릿 힌트만 다듬으세요."}
- JSON: { "question": "..." }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            purpose: "night_pre_journal_reflection",
            lockedDecision: {
              focusCategory: decision.focusCategory,
              contentScore: decision.contentScore,
              primaryTheme: decision.topKeywords[0] ?? null,
              topKeywords: decision.topKeywords,
              templateHint: fallback,
            },
            sajuHints: opts.sajuHints ?? null,
            todayFortune: opts.fortune ?? null,
            weekTheme: decision.weekTheme,
            ganjiKo: opts.ganjiKo ?? null,
            mixRatio: questionMix,
            /** 문장 톤 참고용. 주제 결정에 사용 금지 */
            theoryChunksForWordingOnly: theory.chunks,
            badExamples: [
              "집중과 성장을 위해 어떤 작은 결정을 내릴 수 있었을까?",
              "오늘 어떤 작은 선택을 했을까?",
            ],
            goodExamples: [
              "오늘 집중이 흐트러진 순간이 있었나요?",
              "오늘 「관계」 때문에 마음이 잠깐 멈춘 적이 있었나요?",
              "오늘 몸의 컨디션은 어땠나요?",
            ],
            rules: [
              "Use only primaryTheme — never join two keywords.",
              "No presupposing 'could have decided / for the sake of'.",
              "Do not invent today's check-in scores.",
              "RAG/theory must not pick a new topic.",
              "Follow mixRatio.guideKo and pillarInfluence.",
              "Echo natalSignatures + today mood in everyday language when sajuHints present.",
            ],
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        question: fallback,
        focusCategory: decision.focusCategory,
        contentScore: decision.contentScore,
        openAi: { kind: "failed", reason: "missing_required" },
        theoryUsed: theory.used,
        theoryEvidence: theory.evidence,
        decisionLocked: true,
      };
    }
    const parsed = JSON.parse(raw) as { question?: string };
    const q =
      typeof parsed.question === "string" && parsed.question.trim()
        ? parsed.question.trim().slice(0, 160)
        : fallback;
    return {
      question: q,
      focusCategory: decision.focusCategory,
      contentScore: decision.contentScore,
      openAi: { kind: "used" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      decisionLocked: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      question: fallback,
      focusCategory: decision.focusCategory,
      contentScore: decision.contentScore,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
      decisionLocked: true,
    };
  }
}
