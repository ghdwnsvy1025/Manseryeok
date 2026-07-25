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
}): Promise<TodayQuestionResult> {
  const { decision } = opts;
  const fallback = decision.templateHint;

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
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 일기 앱의 '오늘의 질문' 문장 다듬기 담당입니다.
- 한 문장 질문만 만듭니다.
- lockedDecision의 주제·키워드·포커스를 바꾸지 마세요. 말투만 자연스럽게 다듬습니다.
- 사주 전문용어를 질문에 쓰지 마세요.
${allowRag ? theoryUsageRules("question") : "- theoryChunks 없음. 템플릿 힌트만 다듬으세요."}
- JSON: { "question": "..." }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            lockedDecision: {
              focusCategory: decision.focusCategory,
              contentScore: decision.contentScore,
              topKeywords: decision.topKeywords,
              templateHint: fallback,
            },
            ganjiKo: opts.ganjiKo ?? null,
            /** 문장 톤 참고용. 주제 결정에 사용 금지 */
            theoryChunksForWordingOnly: theory.chunks,
            rules: [
              "Do not change topKeywords or focusCategory.",
              "Do not invent today's check-in scores.",
              "RAG/theory must not pick a new topic.",
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
