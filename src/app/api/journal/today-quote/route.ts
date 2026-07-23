import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { buildBTheme } from "@/lib/journal/bTheme";
import {
  buildContentScoreBundle,
  computeRecentATrend,
} from "@/lib/journal/contentD";
import { generateTodayQuote } from "@/lib/journal/todayQuote";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";

export const runtime = "nodejs";

type Body = {
  entry?: JournalEntry;
  allEntries?: JournalEntry[];
  enabledCodes?: string[];
  sajuProfile?: SajuProfile | null;
  aiSummary?: string | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const b = body as Body;
  if (!b.entry || typeof b.entry.entryDate !== "string") {
    return Response.json({ error: "entry가 필요합니다." }, { status: 400 });
  }

  const enabledCodes = (
    Array.isArray(b.enabledCodes) ? b.enabledCodes : []
  ).filter(isCategoryCode) as CategoryCode[];
  const codes =
    enabledCodes.length > 0
      ? enabledCodes
      : (b.entry.scores.map((s) => s.categoryCode).filter(isCategoryCode) as CategoryCode[]);

  const allEntries = Array.isArray(b.allEntries) ? b.allEntries : [b.entry];
  // 저장본이 allEntries에 없으면 합침
  const merged = allEntries.some((e) => e.id === b.entry!.id)
    ? allEntries
    : [b.entry, ...allEntries];

  const ctx = buildDailySajuContext(b.entry.entryDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);
  const bundle = buildContentScoreBundle({
    entries: merged,
    todayDate: b.entry.entryDate,
    enabledCodes: codes,
  });
  const trend = computeRecentATrend(merged, b.entry.entryDate, codes);

  const result = await generateTodayQuote({
    b: theme,
    entry: b.entry,
    recentAOverall: bundle.recentAOverall,
    trend,
    aiSummary: b.aiSummary,
  });

  return Response.json({
    ...result,
    bTheme: theme,
    recentAOverall: bundle.recentAOverall,
    trend,
  });
}
