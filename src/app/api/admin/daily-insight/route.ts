import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getActiveKeywordMapping } from "@/lib/journal/keywords/mapping";
import { CANONICAL_KEYWORD_VERSION } from "@/lib/journal/keywords/canonical";
import { INSIGHT_ENGINE_VERSION } from "@/lib/journal/insight/types";
import { FORTUNE_SCORE_VERSION } from "@/lib/journal/fortune/score";

export const runtime = "nodejs";

/** 관리자: 날짜별 인사이트/운세/문장 전달 근거 조회 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const eventDate = url.searchParams.get("date");
  const userId = url.searchParams.get("userId");
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return Response.json({ error: "date=YYYY-MM-DD 필요" }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  let insightQuery = sb
    .from("daily_insight_contexts")
    .select("*")
    .eq("event_date", eventDate)
    .limit(20);
  let fortuneQuery = sb
    .from("daily_fortunes")
    .select("*, daily_fortune_sections(*)")
    .eq("event_date", eventDate)
    .limit(20);
  let deliveryQuery = sb
    .from("daily_quote_deliveries")
    .select("*")
    .eq("event_date", eventDate)
    .limit(20);
  let exposureQuery = sb
    .from("content_exposure_events")
    .select("*")
    .eq("event_date", eventDate)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (userId) {
    insightQuery = insightQuery.eq("user_id", userId);
    fortuneQuery = fortuneQuery.eq("user_id", userId);
    deliveryQuery = deliveryQuery.eq("user_id", userId);
    exposureQuery = exposureQuery.eq("user_id", userId);
  }

  const [insight, fortune, delivery, exposure] = await Promise.all([
    insightQuery,
    fortuneQuery,
    deliveryQuery,
    exposureQuery,
  ]);

  return Response.json({
    eventDate,
    userId,
    versions: {
      engine: INSIGHT_ENGINE_VERSION,
      fortuneScore: FORTUNE_SCORE_VERSION,
      canonicalKeywords: CANONICAL_KEYWORD_VERSION,
      keywordMapping: getActiveKeywordMapping().mappingVersion,
    },
    insight: insight.data ?? [],
    fortunes: fortune.data ?? [],
    deliveries: delivery.data ?? [],
    exposures: exposure.data ?? [],
    errors: {
      insight: insight.error?.message ?? null,
      fortune: fortune.error?.message ?? null,
      delivery: delivery.error?.message ?? null,
      exposure: exposure.error?.message ?? null,
    },
  });
}
