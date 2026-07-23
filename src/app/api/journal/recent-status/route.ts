import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import type { HomeEStats } from "@/lib/journal/homeStats";

export const runtime = "nodejs";

type Body = {
  stats?: HomeEStats;
};

function templateStatus(stats: HomeEStats): string {
  const parts: string[] = [];
  if (stats.avg7 != null) parts.push(`최근 7일 행복도 ${stats.avg7}/10`);
  if (stats.best) parts.push(`잘 되는 쪽은 ${stats.best.name}`);
  if (stats.worst) parts.push(`챙길 쪽은 ${stats.worst.name}`);
  if (parts.length === 0) {
    return "아직 기록이 적어 요즘 상태를 자세히 말하기는 이릅니다. 오늘 한 줄만 남겨도 흐름이 선명해져요.";
  }
  return `${parts.join(", ")}. 무리하지 않는 선에서 리듬을 이어가 보세요.`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const b = body as Body;
  if (!b.stats) {
    return Response.json({ error: "stats가 필요합니다." }, { status: 400 });
  }

  const fallback = templateStatus(b.stats);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      message: fallback,
      openAi: { kind: "skipped", detail: "no_api_key" } satisfies OpenAiCallStatus,
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            '일기 앱의 "요즘의 상태"를 2~3문장으로 요약합니다. 진단·미래확정 금지. JSON: { "message": "..." }',
        },
        { role: "user", content: JSON.stringify({ stats: b.stats, hint: fallback }) },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw ? (JSON.parse(raw) as { message?: string }) : {};
    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim().slice(0, 280)
        : fallback;
    return Response.json({
      message,
      openAi: { kind: "used" } satisfies OpenAiCallStatus,
    });
  } catch (err) {
    return Response.json({
      message: fallback,
      openAi: {
        kind: "failed",
        reason: "request_failed",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies OpenAiCallStatus,
    });
  }
}
