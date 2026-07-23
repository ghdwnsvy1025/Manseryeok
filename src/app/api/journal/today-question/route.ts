import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import { generateTodayQuestion } from "@/lib/journal/todayQuestion";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";

export const runtime = "nodejs";

type Body = {
  todayDate?: string;
  enabledCodes?: string[];
  entries?: JournalEntry[];
  sajuProfile?: SajuProfile | null;
  ridgeByCategory?: Partial<Record<string, number | null>>;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const b = body as Body;
  if (typeof b.todayDate !== "string" || !Array.isArray(b.enabledCodes)) {
    return Response.json(
      { error: "todayDate와 enabledCodes가 필요합니다." },
      { status: 400 }
    );
  }

  const enabledCodes = b.enabledCodes.filter(isCategoryCode) as CategoryCode[];
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const ridge: Partial<Record<CategoryCode, number | null>> = {};
  if (b.ridgeByCategory) {
    for (const [k, v] of Object.entries(b.ridgeByCategory)) {
      if (isCategoryCode(k)) ridge[k] = v;
    }
  }

  const ctx = buildDailySajuContext(b.todayDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);
  const bundle = buildContentScoreBundle({
    entries,
    todayDate: b.todayDate,
    enabledCodes,
    ridgeByCategory: ridge,
  });

  const result = await generateTodayQuestion({
    b: theme,
    bundle,
    enabledCodes,
  });

  return Response.json({
    ...result,
    bTheme: theme,
    ganjiKo: ctx.ganjiKo,
  });
}
