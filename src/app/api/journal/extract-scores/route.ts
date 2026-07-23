import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { extractJournalScoresWithAi } from "@/lib/journal/extractScores";
import type { CategoryCode } from "@/lib/journal/types";

export const runtime = "nodejs";

type Body = {
  content?: string;
  enabledCodes?: string[];
  moodLabel?: string | null;
  mainEventText?: string | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const b = body as Body;
  if (typeof b.content !== "string") {
    return Response.json({ error: "content가 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(b.enabledCodes) || b.enabledCodes.length === 0) {
    return Response.json(
      { error: "enabledCodes 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const enabledCodes = b.enabledCodes.filter(isCategoryCode) as CategoryCode[];
  if (enabledCodes.length < 4) {
    return Response.json(
      { error: "활성 카테고리가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const result = await extractJournalScoresWithAi({
    content: b.content,
    enabledCodes,
    moodLabel: b.moodLabel,
    mainEventText: b.mainEventText,
  });

  return Response.json(result);
}
