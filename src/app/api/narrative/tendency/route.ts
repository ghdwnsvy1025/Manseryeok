import { NextRequest } from "next/server";
import { assertNoSensitiveNarrativeFields } from "@/lib/narrative/schema";
import {
  generateTendencyThreeLines,
  type TendencyHints,
} from "@/lib/narrative/tendencySummary";

export const runtime = "nodejs";

function readHints(body: unknown): TendencyHints | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  const src =
    o.hints && typeof o.hints === "object"
      ? (o.hints as Record<string, unknown>)
      : o;
  const hints: TendencyHints = {};
  if (typeof src.ganjiKo === "string") hints.ganjiKo = src.ganjiKo;
  if (typeof src.heavenlyStem === "string") hints.heavenlyStem = src.heavenlyStem;
  if (typeof src.earthlyBranch === "string")
    hints.earthlyBranch = src.earthlyBranch;
  if (typeof src.tenGod === "string" || src.tenGod === null)
    hints.tenGod = src.tenGod as string | null;
  if (Array.isArray(src.elementHints)) {
    hints.elementHints = src.elementHints.filter(
      (x): x is string => typeof x === "string"
    );
  }
  return Object.keys(hints).length > 0 ? hints : undefined;
}

/**
 * POST /api/narrative/tendency
 * admin에서 학습(인덱싱)된 이론 청크가 있을 때만 성향 3줄 생성.
 */
export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sensitive = assertNoSensitiveNarrativeFields(body);
  if (sensitive) {
    return Response.json({ error: sensitive }, { status: 400 });
  }

  const result = await generateTendencyThreeLines(readHints(body));
  if (!result.ok) {
    // 이론 없음·생성 실패는 UI가 안내 문구로 처리 — 5xx로 보이지 않게 함
    const status =
      result.reason === "no_api_key" || result.reason === "no_service_role"
        ? 503
        : 200;
    return Response.json(
      {
        ok: false,
        usedRag: false,
        chunkCount: result.chunkCount,
        reason: result.reason,
        message: result.message,
      },
      { status }
    );
  }

  return Response.json({
    ok: true,
    usedRag: true,
    chunkCount: result.chunkCount,
    lines: result.lines,
  });
}
