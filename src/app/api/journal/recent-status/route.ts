import { NextRequest } from "next/server";
import OpenAI from "openai";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";
import type { HomeEStats } from "@/lib/journal/homeStats";
import {
  buildTemplateRecentStatus,
  normalizeRecentStatus,
} from "@/lib/journal/recentStatus";

export const runtime = "nodejs";

type Body = {
  stats?: HomeEStats;
};

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

  const fallback = buildTemplateRecentStatus(b.stats);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      ...fallback,
      openAi: { kind: "skipped", detail: "no_api_key" } satisfies OpenAiCallStatus,
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
            '일기 앱의 "최근 나의 상태"를 짧게 구조화합니다.',
            "이것은 예측이 아니라 최근 기록의 요약입니다.",
            "진단·미래확정·의학조언 금지. 쉬운 한국어.",
            "JSON만:",
            '{ "headline": "최근 행복도를 직접 설명하는 한 줄(20자 내외, 흐름·리듬 같은 추상어 금지)",',
            '  "coreGood": { "label": "핵심 · 좋아요", "value": "카테고리명", "score": 7.2 } | null,',
            '  "coreWatch": { "label": "핵심 · 아쉬워요", "value": "카테고리명", "score": 4.1 } | null,',
            '  "domainGood": { "label": "선택 · 좋아요", "value": "카테고리명", "score": 7.2 } | null,',
            '  "domainWatch": { "label": "선택 · 아쉬워요", "value": "카테고리명", "score": 4.1 } | null,',
            '  "advice": "짧은 제안 한 문장" }',
            "stats의 core*/domain* 이름이 있으면 각 value에 그 이름을 우선 사용.",
            "선택 영역 데이터가 없으면 domainGood/domainWatch는 null.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            stats: {
              avg7: b.stats.avg7,
              avg30: b.stats.avg30,
              coreBest: b.stats.coreBest,
              coreWorst: b.stats.coreWorst,
              domainBest: b.stats.domainBest,
              domainWorst: b.stats.domainWorst,
              uniqueDays: b.stats.uniqueDays,
            },
            hint: fallback,
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const status = normalizeRecentStatus(parsed, fallback);
    return Response.json({
      ...status,
      openAi: { kind: "used" } satisfies OpenAiCallStatus,
    });
  } catch (err) {
    return Response.json({
      ...fallback,
      openAi: {
        kind: "failed",
        reason: "request_failed",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies OpenAiCallStatus,
    });
  }
}
