import { NextRequest } from "next/server";
import {
  assertNoSensitiveNarrativeFields,
  isNarrativeRequest,
} from "@/lib/narrative/schema";
import { generateGroundedWording } from "@/lib/narrative/groundedWording";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const sensitive = assertNoSensitiveNarrativeFields(body);
  if (sensitive) {
    return Response.json({ error: sensitive }, { status: 400 });
  }

  if (!isNarrativeRequest(body)) {
    return Response.json({ error: "입력 스키마가 올바르지 않습니다." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY가 없습니다.", code: "NO_API_KEY" },
      { status: 503 }
    );
  }

  try {
    const result = await generateGroundedWording({
      surface: body.surface,
      facts: body.facts,
    });
    if (!result) {
      return Response.json(
        { error: "해설 생성 실패", code: "GENERATION_FAILED" },
        { status: 502 }
      );
    }
    return Response.json({
      ok: true,
      surface: body.surface,
      wording: result.wording,
      usedRag: result.usedRag,
      chunkCount: result.chunkCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 호출 실패";
    return Response.json({ error: message, code: "AI_ERROR" }, { status: 502 });
  }
}
