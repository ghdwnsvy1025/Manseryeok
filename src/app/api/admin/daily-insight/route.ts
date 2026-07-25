import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getSupabaseServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getActiveKeywordMapping } from "@/lib/journal/keywords/mapping";
import { CANONICAL_KEYWORD_VERSION } from "@/lib/journal/keywords/canonical";
import { INSIGHT_ENGINE_VERSION } from "@/lib/journal/insight/types";
import { FORTUNE_SCORE_VERSION } from "@/lib/journal/fortune/score";
import { SAJU_RULE_VERSION } from "@/lib/saju/rules";
import {
  getFeatureFlags,
  isSajuRelationsScoringEnabled,
} from "@/lib/app/featureFlags";
import { EVAL_METRICS_VERSION } from "@/lib/personalization/evalMetrics";
import {
  assembleAdminDebugSections,
  getSensitiveAdminEmails,
  isSensitiveAdminEmail,
  stripSensitive,
} from "@/lib/admin/insightDebugView";

export const runtime = "nodejs";

/** 관리자: 날짜별 인사이트/운세/문장 근거 — 섹션형 디버그 */
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
  const wantContent = url.searchParams.get("includeContent") === "1";
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return Response.json({ error: "date=YYYY-MM-DD 필요" }, { status: 400 });
  }

  const sensitiveAccess = isSensitiveAdminEmail(
    auth.user.email,
    getSensitiveAdminEmails()
  );
  const includeContent = wantContent && sensitiveAccess;

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
    .select("id,user_id,event_date,content_type,content_id,event_type,occurred_at,metadata_json")
    .eq("event_date", eventDate)
    .order("occurred_at", { ascending: false })
    .limit(50);
  let questionQuery = sb
    .from("daily_questions")
    .select("id,user_id,question_date,question_text,keyword_codes,evidence,confidence,model_version,context_id,created_at")
    .eq("question_date", eventDate)
    .limit(20);
  let qFeedbackQuery = sb
    .from("question_feedback_events")
    .select("id,user_id,question_date,event_type,rating,created_at")
    .eq("question_date", eventDate)
    .order("created_at", { ascending: false })
    .limit(50);
  let cFeedbackQuery = sb
    .from("content_feedback")
    .select("id,user_id,event_date,content_type,content_id,rating,saved,shared,reopened")
    .eq("event_date", eventDate)
    .limit(50);

  if (userId) {
    insightQuery = insightQuery.eq("user_id", userId);
    fortuneQuery = fortuneQuery.eq("user_id", userId);
    deliveryQuery = deliveryQuery.eq("user_id", userId);
    exposureQuery = exposureQuery.eq("user_id", userId);
    questionQuery = questionQuery.eq("user_id", userId);
    qFeedbackQuery = qFeedbackQuery.eq("user_id", userId);
    cFeedbackQuery = cFeedbackQuery.eq("user_id", userId);
  }

  const [
    insight,
    fortune,
    delivery,
    exposure,
    questions,
    qFeedback,
    cFeedback,
  ] = await Promise.all([
    insightQuery,
    fortuneQuery,
    deliveryQuery,
    exposureQuery,
    questionQuery,
    qFeedbackQuery,
    cFeedbackQuery,
  ]);

  const versions = {
    engine: INSIGHT_ENGINE_VERSION,
    fortuneScore: FORTUNE_SCORE_VERSION,
    canonicalKeywords: CANONICAL_KEYWORD_VERSION,
    keywordMapping: getActiveKeywordMapping().mappingVersion,
    sajuRules: SAJU_RULE_VERSION,
    sajuRelationsScoring: isSajuRelationsScoringEnabled(),
    ridgeEval: EVAL_METRICS_VERSION,
  };
  const flags = {
    sajuRelationsScoringEnabled:
      getFeatureFlags().sajuRelationsScoringEnabled,
  };

  const sections = assembleAdminDebugSections({
    eventDate,
    userId,
    versions,
    flags,
    insightRows: (insight.data ?? []) as Record<string, unknown>[],
    fortuneRows: (fortune.data ?? []) as Record<string, unknown>[],
    deliveryRows: (delivery.data ?? []) as Record<string, unknown>[],
    exposureRows: (exposure.data ?? []) as Record<string, unknown>[],
    questionRows: (questions.data ?? []) as Record<string, unknown>[],
    questionFeedbackRows: (qFeedback.data ?? []) as Record<string, unknown>[],
    contentFeedbackRows: (cFeedback.data ?? []) as Record<string, unknown>[],
    sensitiveAccess,
    includeContent,
  });

  // raw는 민감 권한이 있을 때만, 그것도 strip 후. 기본은 sections만.
  const raw = includeContent
    ? {
        insight: stripSensitive(insight.data ?? []),
        fortunes: stripSensitive(fortune.data ?? []),
        deliveries: delivery.data ?? [],
        questions: stripSensitive(questions.data ?? []),
      }
    : null;

  return Response.json({
    eventDate,
    userId,
    versions,
    flags,
    sections,
    raw,
    privacy: {
      diaryContentIncluded: includeContent,
      sensitiveAccess,
      note: includeContent
        ? "민감정보 권한으로 원문 포함 요청이 허용됨"
        : "일기 원문은 기본적으로 표시하지 않습니다. ADMIN_SENSITIVE_EMAILS + includeContent=1 필요.",
    },
    errors: {
      insight: insight.error?.message ?? null,
      fortune: fortune.error?.message ?? null,
      delivery: delivery.error?.message ?? null,
      exposure: exposure.error?.message ?? null,
      questions: questions.error?.message ?? null,
      questionFeedback: qFeedback.error?.message ?? null,
      contentFeedback: cFeedback.error?.message ?? null,
    },
  });
}
