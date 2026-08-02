/**
 * POST /api/journal/week-topic-support
 * 템플릿 초고 → 짧은 GPT 다듬기(운세 polish와 동일 패턴).
 * 긴 발췌·JSON 다중 생성은 쓰지 않아 빠르게 응답한다.
 */
import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import { requireAuthUser } from "@/lib/api/requireAuth";
import { checkLlmRateLimit } from "@/lib/api/rateLimit";
import { polishTopicCombinedAdvice } from "@/lib/journal/topics/polishTopicAdvice";

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
        .slice(0, 2)
        .map((e) => ({
          date: typeof e.date === "string" ? e.date : "",
          text:
            typeof e.text === "string"
              ? e.text.replace(/\s+/g, " ").trim().slice(0, 120)
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
  const first = topics[0]!;
  if (first.fallbackLine) return first.fallbackLine;
  if (topics.length === 1) {
    return `「${first.label}」이(가) 마음에 자주 남았다면, 오늘은 그 결을 한 호흡만 부드럽게 안아 주세요.`;
  }
  return `요즘 마음에 맴도는 이야기들이 있다면, 그중 가장 가벼운 것부터 짧게 돌봐 주세요.`;
}

/** 다듬기용 — 상위 화제 일기 조각 1개만 (짧게) */
function pickHint(topics: SanitizedTopic[]): string | undefined {
  for (const t of topics) {
    const ex = t.excerpts[0];
    if (ex?.text) return ex.text.slice(0, 120);
  }
  return undefined;
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

  try {
    const client = new OpenAI({ apiKey });
    const combinedAdvice = await polishTopicCombinedAdvice(
      combinedFallback,
      client,
      {
        themeLabels: topics.map((t) => t.label).join(", "),
        hint: pickHint(topics),
      }
    );

    return Response.json({
      lines: fallbackLines,
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
