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

function sanitizeTopics(raw: TopicIn[] | undefined): Array<{
  topicId: string;
  label: string;
  dayCount: number;
  excerpts: Array<{ date: string; text: string }>;
  fallbackLine: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((t) => {
      const topicId = typeof t.topicId === "string" ? t.topicId.trim() : "";
      const label = typeof t.label === "string" ? t.label.trim() : "";
      if (!topicId || !label) return null;
      const excerpts = (Array.isArray(t.excerpts) ? t.excerpts : [])
        .slice(0, 7)
        .map((e) => ({
          date: typeof e.date === "string" ? e.date : "",
          text:
            typeof e.text === "string"
              ? e.text.replace(/\s+/g, " ").trim().slice(0, 420)
              : "",
        }))
        .filter((e) => e.date && e.text);
      return {
        topicId,
        label,
        dayCount:
          typeof t.dayCount === "number" && t.dayCount > 0
            ? Math.min(7, Math.floor(t.dayCount))
            : excerpts.length,
        excerpts,
        fallbackLine:
          typeof t.fallbackLine === "string" && t.fallbackLine.trim()
            ? t.fallbackLine.trim().slice(0, 220)
            : `${label} 이야기를 남긴 날들이 있었어요, 오늘은 그 마음을 조금 부드럽게 안아 주세요.`,
      };
    })
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
}

/**
 * POST /api/journal/week-topic-support
 * 화제가 등장한 각 날의 일기 본문을 종합해 위로+조언 한 문장 생성
 */
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      lines: fallbackLines,
      openAi: { kind: "skipped", detail: "no_api_key" } satisfies OpenAiCallStatus,
    });
  }

  // 본문이 거의 없으면 LLM 생략
  const withText = topics.filter((t) => t.excerpts.length > 0);
  if (withText.length === 0) {
    return Response.json({
      lines: fallbackLines,
      openAi: { kind: "skipped", detail: "no_excerpts" } satisfies OpenAiCallStatus,
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "당신은 일기 앱의 따뜻한 상담 문장 작가입니다.",
            "각 화제마다, 제공된 일기 발췌를 빠짐없이 모두 읽고 종합하세요.",
            "등장 횟수는 1~7일 어떤 값이든 됩니다. excerpts 배열 길이(1이면 1개, 4이면 4개, 7이면 7개)만큼 전부 반영하세요.",
            "일부를 건너뛰거나 대표 하루만 고르지 마세요.",
            "출력은 화제당 위로와 앞길을 위한 조언을 합친 한국어 한 문장(쉼표로 이어진 한 호흡, 80자 내외).",
            "점수·수치·진단·예언·의학조언 금지. 일기 속 구체적 뉘앙스를 반영하되 인용부호로 길게 베끼지 마세요.",
            'JSON만: { "lines": { "<topicId>": "한 문장" } }',
            "입력에 있는 모든 topicId 키를 반드시 채우세요.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            asOf: b.asOf ?? null,
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
    const parsed = raw ? (JSON.parse(raw) as { lines?: Record<string, unknown> }) : null;
    const lines: Record<string, string> = { ...fallbackLines };
    if (parsed?.lines && typeof parsed.lines === "object") {
      for (const t of topics) {
        const v = parsed.lines[t.topicId];
        if (typeof v === "string" && v.trim()) {
          const cleaned = v
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\d+(\.\d+)?\s*점/g, "")
            .slice(0, 220);
          if (cleaned.length >= 12) lines[t.topicId] = cleaned;
        }
      }
    }

    return Response.json({
      lines,
      openAi: { kind: "used" } satisfies OpenAiCallStatus,
    });
  } catch (err) {
    return Response.json({
      lines: fallbackLines,
      openAi: {
        kind: "failed",
        reason: "request_failed",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies OpenAiCallStatus,
    });
  }
}
