/**
 * 오늘의 질문 — B + 최근A + D (§15)
 * OpenAI 실패 시 템플릿 fallback
 */
import OpenAI from "openai";
import { getCategoryByCode } from "./categoryCatalog";
import type { BTheme } from "./bTheme";
import type { ContentScoreBundle } from "./contentD";
import type { CategoryCode } from "./types";
import type { OpenAiCallStatus } from "./openaiStatus";
import {
  isHighJournalScore,
  isLowJournalScore,
  scoreBandLabel,
} from "./scoreScale";
import {
  loadTheoryContext,
  theoryUsageRules,
  type TheoryEvidence,
} from "./theoryContext";

export type TodayQuestionResult = {
  question: string;
  focusCategory: CategoryCode | null;
  contentScore: number | null;
  openAi: OpenAiCallStatus;
  theoryUsed: boolean;
  theoryEvidence: TheoryEvidence[];
};

function pickFocusCategory(
  bundle: ContentScoreBundle,
  enabled: CategoryCode[],
  hints: string[]
): CategoryCode | null {
  for (const h of hints) {
    if (enabled.includes(h as CategoryCode)) return h as CategoryCode;
  }
  // 점수가 가장 낮은 카테고리 우선 (질문이 더 의미 있음)
  let worst: { code: CategoryCode; v: number } | null = null;
  for (const code of enabled) {
    const v = bundle.contentScoreByCategory[code]?.value;
    if (v == null) continue;
    if (!worst || v < worst.v) worst = { code, v };
  }
  return worst?.code ?? enabled[0] ?? null;
}

export function buildQuestionTemplate(opts: {
  b: BTheme;
  focus: CategoryCode | null;
  contentScore: number | null;
}): string {
  const name = opts.focus
    ? getCategoryByCode(opts.focus)?.name ?? opts.focus
    : "하루";
  const band = scoreBandLabel(opts.contentScore);
  const kw = opts.b.keywords.slice(0, 2).join("·") || "균형";

  if (opts.contentScore == null) {
    return `${opts.b.plainSummary} 오늘은 「${kw}」 중 어떤 마음이 더 컸나요?`;
  }

  if (isLowJournalScore(opts.contentScore)) {
    return `최근 「${name}」 흐름이 ${band} 편이에요. 오늘 ${kw} 사이에서, 스스로에게 가장 버거웠던 순간은 무엇이었나요?`;
  }
  if (isHighJournalScore(opts.contentScore)) {
    return `최근 「${name}」이 비교적 ${band}이에요. 오늘 그 기운을 잘 쓴 순간이 있다면, 무엇이 도움이 되었나요?`;
  }
  return `오늘은 ${kw}가 주제일 수 있어요. 「${name}」 기준으로, 끌리는 쪽과 거리를 두고 싶은 쪽 중 어디가 더 컸나요?`;
}

export async function generateTodayQuestion(opts: {
  b: BTheme;
  bundle: ContentScoreBundle;
  enabledCodes: CategoryCode[];
  ganjiKo?: string | null;
}): Promise<TodayQuestionResult> {
  const focus = pickFocusCategory(
    opts.bundle,
    opts.enabledCodes,
    opts.b.focusCategoryHints
  );
  const contentScore = focus
    ? opts.bundle.contentScoreByCategory[focus]?.value ?? null
    : opts.bundle.recentAOverall;

  const fallback = buildQuestionTemplate({
    b: opts.b,
    focus,
    contentScore,
  });

  const theory = await loadTheoryContext({
    b: opts.b,
    ganjiKo: opts.ganjiKo,
    purpose: "question",
    matchCount: 5,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      question: fallback,
      focusCategory: focus,
      contentScore,
      openAi: { kind: "skipped", detail: "no_api_key" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
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
          content: `당신은 일기 앱의 '오늘의 질문' 작성자입니다.
- 한 문장 질문만 만듭니다.
${theoryUsageRules("question")}
- JSON: { "question": "..." }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            bTheme: opts.b,
            ganjiKo: opts.ganjiKo ?? null,
            focusCategory: focus,
            contentScore,
            recentA: opts.bundle.recentAByCategory,
            theoryChunks: theory.chunks,
            templateHint: fallback,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        question: fallback,
        focusCategory: focus,
        contentScore,
        openAi: { kind: "failed", reason: "missing_required" },
        theoryUsed: theory.used,
        theoryEvidence: theory.evidence,
      };
    }
    const parsed = JSON.parse(raw) as { question?: string };
    const q =
      typeof parsed.question === "string" && parsed.question.trim()
        ? parsed.question.trim().slice(0, 160)
        : fallback;
    return {
      question: q,
      focusCategory: focus,
      contentScore,
      openAi: { kind: "used" },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      question: fallback,
      focusCategory: focus,
      contentScore,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
      theoryUsed: theory.used,
      theoryEvidence: theory.evidence,
    };
  }
}
