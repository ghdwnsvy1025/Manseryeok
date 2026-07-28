import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { buildBTheme } from "@/lib/journal/bTheme";
import {
  buildContentScoreBundle,
  computeRecentATrend,
} from "@/lib/journal/contentD";
import { generateTodayQuote } from "@/lib/journal/todayQuote";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { scoreFortuneDomains } from "@/lib/journal/fortune/score";
import {
  loadRecentDeliveries,
  retrieveQuoteCandidates,
} from "@/lib/journal/quote/repository";
import type { QuoteLibraryItem } from "@/lib/journal/quote/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveSajuProfileId } from "@/lib/diary/activeSajuProfile";
import {
  isQuoteRagEnabled,
  isVerifiedQuoteEnabled,
} from "@/lib/app/featureFlags";

export const runtime = "nodejs";

type Body = {
  entry?: JournalEntry;
  allEntries?: JournalEntry[];
  enabledCodes?: string[];
  sajuProfile?: SajuProfile | null;
  aiSummary?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      : (b.entry.scores
          .map((s) => s.categoryCode)
          .filter(isCategoryCode) as CategoryCode[]);

  const allEntries = Array.isArray(b.allEntries) ? b.allEntries : [b.entry];
  const merged = allEntries.some((e) => e.id === b.entry!.id)
    ? allEntries
    : [b.entry, ...allEntries];

  const insight = buildDailyInsightContext({
    eventDate: b.entry.entryDate,
    entries: merged,
    enabledCodes: codes,
    sajuProfile: b.sajuProfile ?? null,
  });
  const fortuneDomains = scoreFortuneDomains(insight);
  const overall = fortuneDomains.find((d) => d.domain === "overall");

  const ctx = buildDailySajuContext(b.entry.entryDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);
  const bundle = buildContentScoreBundle({
    entries: merged,
    todayDate: b.entry.entryDate,
    enabledCodes: codes,
  });
  const trend = computeRecentATrend(merged, b.entry.entryDate, codes);

  let quoteCandidates: QuoteLibraryItem[] = [];
  let recentDeliveries: Awaited<ReturnType<typeof loadRecentDeliveries>> = [];
  let recentSentences: string[] = [];
  let userId: string | null = null;
  let sajuProfileId: string | null = null;

  const sb = getSupabaseServerClient();
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    userId = user?.id ?? null;
    if (userId) {
      sajuProfileId =
        b.sajuProfile?.id ?? (await resolveActiveSajuProfileId(sb, userId));
      recentDeliveries = await loadRecentDeliveries(userId, {
        sinceDays: 180,
        limit: 200,
        sajuProfileId: sajuProfileId ?? undefined,
      });
      recentSentences = recentDeliveries
        .map((r) => r.text)
        .filter((t): t is string => Boolean(t));
    }
  }

  if (isVerifiedQuoteEnabled() && isQuoteRagEnabled()) {
    const query = [
      insight.primaryKeyword,
      insight.tensionKeyword,
      overall?.headline,
      b.aiSummary?.slice(0, 120),
      b.entry.moodLabels?.join(" "),
    ]
      .filter(Boolean)
      .join(" · ");
    quoteCandidates = await retrieveQuoteCandidates(
      query || theme.plainSummary,
      12
    );
  }

  // 같은 날짜·프로필 이미 delivery 있으면 재생성하지 않음 (수정 저장 시 유지)
  if (sb && userId && sajuProfileId) {
    const { data: existing } = await sb
      .from("daily_quote_deliveries")
      .select(
        "id, content_type, generated_original_text, quote_id, selection_score, selection_reasons_json"
      )
      .eq("user_id", userId)
      .eq("saju_profile_id", sajuProfileId)
      .eq("event_date", b.entry.entryDate)
      .order("delivered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.generated_original_text) {
      const reasons =
        (existing.selection_reasons_json as Record<string, unknown>) ?? {};
      return Response.json({
        quote: existing.generated_original_text,
        sentence: existing.generated_original_text,
        contentType: existing.content_type,
        sourceLabel:
          typeof reasons.sourceLabel === "string"
            ? reasons.sourceLabel
            : existing.content_type === "verified_quote"
              ? "검증된 명언"
              : "앱이 건넨 문장",
        authorName:
          typeof reasons.authorName === "string" ? reasons.authorName : null,
        workTitle:
          typeof reasons.workTitle === "string" ? reasons.workTitle : null,
        attribution: null,
        quoteId: existing.quote_id,
        selectionScore: existing.selection_score,
        selectionReason: "reuse_same_day_delivery",
        generationContext: reasons.generationContext ?? {},
        promptVersion: reasons.promptVersion ?? null,
        safetyFilterVersion: reasons.safetyFilterVersion ?? null,
        openAi: { kind: "skipped", detail: "cached_delivery" },
        theoryUsed: false,
        theoryEvidence: [],
        delivery: { deliveryId: existing.id, recorded: true, reused: true },
        bTheme: theme,
        recentAOverall: bundle.recentAOverall,
        trend,
      });
    }
  }

  const result = await generateTodayQuote({
    b: theme,
    entry: b.entry,
    recentAOverall: bundle.recentAOverall,
    trend,
    aiSummary: b.aiSummary,
    ganjiKo: ctx.ganjiKo,
    primaryKeyword: insight.primaryKeyword,
    tensionKeyword: insight.tensionKeyword,
    fortuneTheme: overall?.headline ?? null,
    recentSentences,
    quoteCandidates,
    recentDeliveries,
  });

  let deliveryId: string | null = null;
  let recorded = false;
  if (sb && userId && sajuProfileId) {
    const { data, error } = await sb
      .from("daily_quote_deliveries")
      .insert({
        user_id: userId,
        saju_profile_id: sajuProfileId,
        event_date: b.entry.entryDate,
        journal_entry_id: UUID_RE.test(b.entry.id) ? b.entry.id : null,
        quote_id: result.quoteId,
        generated_original_text: result.sentence,
        content_type: result.contentType,
        selection_score: result.selectionScore,
        selection_reasons_json: {
          selectionReason: result.selectionReason,
          sourceLabel: result.sourceLabel,
          authorName: result.authorName,
          workTitle: result.workTitle,
          generationContext: result.generationContext,
          promptVersion: result.promptVersion,
          safetyFilterVersion: result.safetyFilterVersion,
        },
        model_version:
          process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      })
      .select("id")
      .single();
    if (!error && data?.id) {
      deliveryId = String(data.id);
      recorded = true;
      // 여기는 "전달 생성" 시점이지 "사용자가 본" 시점이 아니다.
      // 실제 impression은 모달이 렌더될 때 클라이언트가 발화한다.
      // 둘 다 impression으로 찍으면 노출 수가 두 배로 부풀려진다.
      await sb.from("content_exposure_events").insert({
        user_id: userId,
        saju_profile_id: sajuProfileId,
        event_date: b.entry.entryDate,
        content_type: result.contentType,
        content_id: deliveryId,
        event_type: "delivered",
        metadata_json: { surface: "journal_save_complete" },
      });
    }
  }

  return Response.json({
    ...result,
    delivery: { deliveryId, recorded },
    bTheme: theme,
    recentAOverall: bundle.recentAOverall,
    trend,
  });
}
