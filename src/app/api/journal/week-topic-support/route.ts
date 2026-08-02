/**
 * POST /api/journal/week-topic-support
 * 상위 화제(최대 3)의 일기 발췌를 종합해
 * - 화제별 한 문장(lines)
 * - 화제들을 묶은 합쳐 조언(combinedAdvice)
 */
import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import { requireAuthUser } from "@/lib/api/requireAuth";
import { checkLlmRateLimit } from "@/lib/api/rateLimit";

export const runtime = "nodejs";

type Excerpt = { date?: string; text?: string };
type TopicIn = {
  topicId?: string;
  label?: string;
  dayCount?: number;
  excerpts?: Excerpt[];
  fallbackLine?: string;
};

type Body = {
  asOf?: string;
  topics?: TopicIn[];
};

type SanitizedTopic = {
  topicId: string;
  label: string;
  dayCount: number;
  excerpts: Array<{ date: string; text: string }>;
  fallbackLine: string;
};

function sanitizeTopics(raw: TopicIn[] | undefined): SanitizedTopic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((t) => {
      const topicId = typeof t.topicId === "string" ? t.topicId.trim() : "";
      const label = typeof t.label === "string" ? t.label.trim() : "";
      if (!topicId || !label) return null;
      const excerpts = (Array.isArray(t.excerpts) ? t.excerpts : [])
        .slice(0, 12)
        .map((e) => ({
          date: typeof e.date === "string" ? e.date : "",
          text:
            typeof e.text === "string"
              ? e.text.replace(/\s+/g, " ").trim().slice(0, 320)
              : "",
        }))
        .filter((e) => e.date && e.text);
      return {
        topicId,
        label,
        dayCount:
          typeof t.dayCount === "number" && t.dayCount > 0
            ? Math.min(30, Math.floor(t.dayCount))
            : excerpts.length,
        excerpts,
        fallbackLine:
          typeof t.fallbackLine === "string" && t.fallbackLine.trim()
            ? t.fallbackLine.trim().slice(0, 220)
            : `${label} 이야기를 남긴 날들이 있었어요, 오늘은 그 마음을 조금 부드럽게 안아 주세요.`,
      };
    })
    .filter((t): t is SanitizedTopic => Boolean(t));
}

function buildCombinedFallback(topics: SanitizedTopic[]): string {
  if (topics.length === 0) return "";
  const labels = topics.map((t) => t.label);
  if (labels.length === 1) {
    return (
      topics[0]!.fallbackLine ||
      `「${labels[0]}」이(가) 요즘 이야기의 축이었어요. 오늘은 그 마음을 한 호흡만 부드럽게 안아 주세요.`
    );
  }
  const joined = labels.join(" · ");
  return `요즘 「${joined}」이(가) 이야기의 축이었어요. 한 가지만 붙잡지 말고, 그중 가장 가벼운 것부터 짧게 돌봐 보세요.`;
}

function cleanAdvice(raw: string, max = 240): string | null {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\d+(\.\d+)?\s*점/g, "")
    .slice(0, max);
  return cleaned.length >= 12 ? cleaned : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthUser();
  if (!auth.ok) return auth.response;
  const limited = checkLlmRateLimit(auth.user.id);
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const b = body as Body;
  const topics = sanitizeTopics(b.topics);
  if (topics.length === 0) {
    return Response.json({ error: "topics가 필요합니다." }, { status: 400 });
  }

  const fallbackLines: Record<string, string> = {};
  for (const t of topics) fallbackLines[t.topicId] = t.fallbackLine;
  const combinedFallback = buildCombinedFallback(topics);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      lines: fallbackLines,
      combinedAdvice: combinedFallback,
      openAi: { kind: "skipped", detail: "no_api_key" } satisfies OpenAiCallStatus,
    });
  }

  const withText = topics.filter((t) => t.excerpts.length > 0);
  if (withText.length === 0) {
    return Response.json({
      lines: fallbackLines,
      combinedAdvice: combinedFallback,
      openAi: { kind: "skipped", detail: "no_excerpts" } satisfies OpenAiCallStatus,
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const labelList = topics.map((t) => t.label).join(" · ");
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "당신은 일기 앱의 따뜻한 상담 문장 작가입니다.",
            "입력은 최근 일기에서 뽑은 대표 화제(최대 3개)와 각 화제가 나온 날의 일기 발췌입니다.",
            "1) combinedAdvice: 화제들을 하나의 이야기로 묶어, 위로와 앞길 조언을 합친 한국어 한 문장(100자 내외).",
            "   화제 이름을 자연스럽게 언급해도 됩니다. 나열만 하지 말고 연결해서 말하세요.",
            "2) lines: 화제별 짧은 한 문장(60자 내외). 보조 설명용.",
            "점수·수치·진단·예언·의학조언 금지. 길게 인용하지 마세요.",
            'JSON만: { "combinedAdvice": "한 문장", "lines": { "<topicId>": "한 문장" } }',
            "입력의 모든 topicId 키를 lines에 채우세요.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            asOf: b.asOf ?? null,
            themeLabels: labelList,
            topics: withText.map((t) => ({
              topicId: t.topicId,
              label: t.label,
              occurrenceCount: t.excerpts.length,
              diaryExcerpts: t.excerpts,
              fallbackHint: t.fallbackLine,
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    const parsed = raw
      ? (JSON.parse(raw) as {
          lines?: Record<string, unknown>;
          combinedAdvice?: unknown;
        })
      : null;

    const lines: Record<string, string> = { ...fallbackLines };
    if (parsed?.lines && typeof parsed.lines === "object") {
      for (const t of topics) {
        const v = parsed.lines[t.topicId];
        if (typeof v === "string" && v.trim()) {
          const cleaned = cleanAdvice(v, 180);
          if (cleaned) lines[t.topicId] = cleaned;
        }
      }
    }

    let combinedAdvice = combinedFallback;
    if (typeof parsed?.combinedAdvice === "string" && parsed.combinedAdvice.trim()) {
      const cleaned = cleanAdvice(parsed.combinedAdvice, 260);
      if (cleaned) combinedAdvice = cleaned;
    }

    return Response.json({
      lines,
      combinedAdvice,
      openAi: { kind: "used" } satisfies OpenAiCallStatus,
    });
  } catch (err) {
    return Response.json({
      lines: fallbackLines,
      combinedAdvice: combinedFallback,
      openAi: {
        kind: "failed",
        reason: "request_failed",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies OpenAiCallStatus,
    });
  }
}
