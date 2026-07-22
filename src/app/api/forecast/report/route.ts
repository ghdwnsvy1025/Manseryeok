import { NextRequest } from "next/server";
import {
  assertNoSensitiveFields,
  isForecastAiInput,
  parseForecastAiOutput,
  sanitizeAiOutput,
} from "@/lib/forecast/aiSchema";
import { generateGroundedWording } from "@/lib/narrative/groundedWording";

export const runtime = "nodejs";

/**
 * 내일 예보 문구화 — 학습된 사주 이론(RAG)을 검색해 반영합니다.
 * 일기 원문·생년월일은 받지 않습니다.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const sensitive = assertNoSensitiveFields(body);
  if (sensitive) {
    return Response.json({ error: sensitive }, { status: 400 });
  }

  if (!isForecastAiInput(body)) {
    return Response.json({ error: "입력 스키마가 올바르지 않습니다." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY가 없어 AI 문구화를 건너뜁니다.", code: "NO_API_KEY" },
      { status: 503 }
    );
  }

  try {
    const result = await generateGroundedWording({
      surface: "forecast",
      facts: {
        targetDate: body.targetDate,
        ganjiKo: body.tomorrowSaju.dayGanjiKo,
        heavenlyStem: body.tomorrowSaju.heavenlyStem,
        earthlyBranch: body.tomorrowSaju.earthlyBranch,
        tenGod: body.tomorrowSaju.tenGod,
        relationLabels: body.tomorrowSaju.relationLabels,
        languageLevel: body.languageLevel,
        sampleSizes: body.similarDayStatistics.sampleSizes,
        moodAverage: body.similarDayStatistics.moodAverage,
        energyAverage: body.similarDayStatistics.energyAverage,
        frequentTags: body.similarDayStatistics.frequentTags,
        todayStructured: body.todayStructured,
        localDraft: body.localDraft,
      },
    });

    if (!result) {
      return Response.json({ error: "AI 응답 생성 실패" }, { status: 502 });
    }

    const output = parseForecastAiOutput(result.wording);
    if (!output) {
      return Response.json({ error: "AI 출력 스키마 검증 실패" }, { status: 502 });
    }

    const safe = sanitizeAiOutput(output);
    if (!safe) {
      return Response.json(
        { error: "금지 표현이 포함되어 출력을 거부했습니다." },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      wording: safe,
      usedRag: result.usedRag,
      chunkCount: result.chunkCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 호출 실패";
    return Response.json({ error: message, code: "AI_ERROR" }, { status: 502 });
  }
}
