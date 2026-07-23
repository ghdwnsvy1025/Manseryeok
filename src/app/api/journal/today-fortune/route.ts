import { NextRequest } from "next/server";
import { buildBTheme } from "@/lib/journal/bTheme";
import { generateTodayFortune } from "@/lib/journal/todayFortune";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";

export const runtime = "nodejs";

type Body = {
  todayDate?: string;
  sajuProfile?: SajuProfile | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }
  const b = body as Body;
  if (typeof b.todayDate !== "string") {
    return Response.json({ error: "todayDate가 필요합니다." }, { status: 400 });
  }

  const ctx = buildDailySajuContext(b.todayDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);
  const result = await generateTodayFortune(theme);

  return Response.json({
    ...result,
    ganjiKo: ctx.ganjiKo,
    bTheme: theme,
  });
}
