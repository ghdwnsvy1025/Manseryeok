/**
 * 개인화된 오늘의 명언 — 저장 직후 (§16)
 * 유명 명언 인용 금지. OpenAI 실패 시 템플릿.
 */
import OpenAI from "openai";
import { getCategoryByCode } from "./categoryCatalog";
import { getTagName } from "./eventTagCatalog";
import type { BTheme } from "./bTheme";
import type { OpenAiCallStatus } from "./openaiStatus";
import type { CategoryCode, JournalEntry } from "./types";
import { isLowJournalScore } from "./scoreScale";

export type TodayQuoteInput = {
  b: BTheme;
  entry: JournalEntry;
  recentAOverall: number | null;
  trend: { delta: number | null; direction: "up" | "down" | "flat" | "unknown" };
  aiSummary?: string | null;
};

export type TodayQuoteResult = {
  quote: string;
  openAi: OpenAiCallStatus;
};

function lowestFinal(entry: JournalEntry): {
  code: CategoryCode;
  score: number;
} | null {
  let worst: { code: CategoryCode; score: number } | null = null;
  for (const s of entry.scores) {
    if (s.isNotApplicable || s.finalScore == null) continue;
    if (!worst || s.finalScore < worst.score) {
      worst = { code: s.categoryCode, score: s.finalScore };
    }
  }
  return worst;
}

export function buildQuoteTemplate(input: TodayQuoteInput): string {
  const mood = input.entry.moodLabel;
  const tags = input.entry.tags
    .map((t) => getTagName(t.tagCode))
    .slice(0, 2)
    .join(", ");
  const low = lowestFinal(input.entry);
  const lowName = low ? getCategoryByCode(low.code)?.name : null;
  const kw = input.b.keywords[0] ?? "균형";

  if (mood === "지침" || mood === "불안" || (low && isLowJournalScore(low.score))) {
    return `오늘의 피로는 당신이 약해서가 아니라, ${kw} 앞에서 애쓴 흔적일 수 있어요. ${
      lowName ? `「${lowName}」이 무거웠다면, ` : ""
    }이제는 잠시 속도를 낮추는 것도 오늘을 잘 살아낸 방식이에요.`;
  }

  if (input.trend.direction === "up") {
    return `최근 흐름이 조금씩 나아지고 있어요. 오늘 ${
      tags || "남긴 기록"
    } 속에서 마음에 남은 작은 힘을 내일도 붙잡아 보세요.`;
  }

  if (mood === "기쁨" || mood === "설렘") {
    return `가벼운 마음이 찾아온 날이에요. ${kw}의 기운을 억지로 키우기보다, 지금 편안한 감각을 조금 더 오래 머무르게 해 주세요.`;
  }

  return `사람들과의 거리나 일의 속도가 마음처럼 조절되지 않는 날도 있어요. 오늘은 완벽한 답보다, 내 마음이 편해지는 ${kw}의 거리를 먼저 찾아보세요.`;
}

export async function generateTodayQuote(
  input: TodayQuoteInput
): Promise<TodayQuoteResult> {
  const fallback = buildQuoteTemplate(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      quote: fallback,
      openAi: { kind: "skipped", detail: "no_api_key" },
    };
  }

  const finals = input.entry.scores
    .filter((s) => !s.isNotApplicable && s.finalScore != null)
    .map((s) => ({
      category: getCategoryByCode(s.categoryCode)?.name ?? s.categoryCode,
      final: s.finalScore,
      user: s.userScore,
      ai: s.aiScore,
    }));

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 일기 저장 직후 '오늘의 명언'을 씁니다.
규칙:
- 1~2문장, 감성적이되 구체적.
- 유명인 명언 인용·출처 흉내 금지.
- 미래 확정, 불행/사고 예고, 비난, 추상 자기계발 문구 금지.
- 오늘의 감정 인정 + 편안해질 작은 방향.
- JSON: { "quote": "..." }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            bTheme: input.b,
            mood: input.entry.moodLabel,
            tags: input.entry.tags.map((t) => getTagName(t.tagCode)),
            finals,
            recentAOverall: input.recentAOverall,
            trend: input.trend,
            diarySummary: input.aiSummary ?? input.entry.content.slice(0, 400),
            templateHint: fallback,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        quote: fallback,
        openAi: { kind: "failed", reason: "missing_required" },
      };
    }
    const parsed = JSON.parse(raw) as { quote?: string };
    const quote =
      typeof parsed.quote === "string" && parsed.quote.trim()
        ? parsed.quote.trim().slice(0, 320)
        : fallback;
    return { quote, openAi: { kind: "used" } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      quote: fallback,
      openAi: { kind: "failed", reason: "request_failed", detail: msg },
    };
  }
}
