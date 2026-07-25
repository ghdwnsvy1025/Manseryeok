import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import { generateTodayQuestion } from "@/lib/journal/todayQuestion";
import {
  buildRidgeShadowReport,
  decideTodayQuestion,
} from "@/lib/journal/questionDecision";
import { entriesStrictlyBefore } from "@/lib/journal/recentA";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import {
  aggregateKeywordBiasesFromEvents,
  type KeywordBiasMap,
} from "@/lib/journal/keywords/learning";
import { isKeywordCode } from "@/lib/journal/keywords/catalog";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";
import { isRidgeQuestionLiveEnabled } from "@/lib/app/featureFlags";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";

export const runtime = "nodejs";

type Body = {
  todayDate?: string;
  enabledCodes?: string[];
  entries?: JournalEntry[];
  sajuProfile?: SajuProfile | null;
  ridgeByCategory?: Partial<Record<string, number | null>>;
  /** 클라 로컬 학습 편향 */
  keywordBiases?: KeywordBiasMap;
};

function sanitizeBiases(raw: unknown): KeywordBiasMap {
  if (!raw || typeof raw !== "object") return {};
  const out: KeywordBiasMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isKeywordCode(k) && typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}

async function loadServerFeedbackBiases(): Promise<KeywordBiasMap> {
  const sb = getSupabaseServerClient();
  if (!sb) return {};
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return {};

  const { data, error } = await sb
    .from("question_feedback_events")
    .select("event_type, payload")
    .eq("user_id", user.id)
    .in("event_type", ["fit_good", "fit_bad", "led_to_write", "skipped", "dismissed"])
    .order("created_at", { ascending: false })
    .limit(120);

  if (error || !data) return {};

  return aggregateKeywordBiasesFromEvents(
    data.map((row) => ({
      eventType: String(row.event_type),
      payload: (row.payload ?? {}) as { keywords?: string[] },
    }))
  );
}

function mergeBiases(a: KeywordBiasMap, b: KeywordBiasMap): KeywordBiasMap {
  const out: KeywordBiasMap = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!isKeywordCode(k) || typeof v !== "number") continue;
    out[k] = Math.round(((out[k] ?? 0) + v) * 100) / 100;
  }
  return out;
}

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
  const rawEntries = Array.isArray(b.entries) ? b.entries : [];
  const priorEntries = entriesStrictlyBefore(rawEntries, b.todayDate);

  const ridge: Partial<Record<CategoryCode, number | null>> = {};
  if (b.ridgeByCategory) {
    for (const [k, v] of Object.entries(b.ridgeByCategory)) {
      if (isCategoryCode(k)) ridge[k] = v;
    }
  }
  const hasRidge = Object.keys(ridge).length > 0;
  const ridgeLive = isRidgeQuestionLiveEnabled();

  const clientBiases = sanitizeBiases(b.keywordBiases);
  const serverBiases = await loadServerFeedbackBiases();
  const keywordBiases = mergeBiases(serverBiases, clientBiases);

  const ctx = buildDailySajuContext(b.todayDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);

  const liveBundle = buildContentScoreBundle({
    entries: priorEntries,
    todayDate: b.todayDate,
    enabledCodes,
    ridgeByCategory: ridgeLive ? ridge : undefined,
    excludeToday: true,
  });

  const shadowBundle =
    hasRidge && !ridgeLive
      ? buildContentScoreBundle({
          entries: priorEntries,
          todayDate: b.todayDate,
          enabledCodes,
          ridgeByCategory: ridge,
          excludeToday: true,
        })
      : null;

  const keywords = rankKeywordsForQuestion({
    bundle: liveBundle,
    priorEntries,
    b: theme,
    topN: 3,
    keywordBiases,
  });

  const decision = decideTodayQuestion({
    b: theme,
    bundle: liveBundle,
    enabledCodes,
    keywordRanking: keywords,
  });

  const result = await generateTodayQuestion({
    b: theme,
    decision,
    ganjiKo: ctx.ganjiKo,
  });

  const ridgeShadow = shadowBundle
    ? buildRidgeShadowReport({
        live: liveBundle,
        shadow: shadowBundle,
        enabledCodes,
      })
    : null;

  // 공통 컨텍스트 (질문 결정 로직 비변경 — 응답에만 첨부)
  const insight = buildDailyInsightContext({
    eventDate: b.todayDate,
    entries: rawEntries,
    enabledCodes,
    sajuProfile: b.sajuProfile ?? null,
    keywordBiases,
  });

  return Response.json({
    ...result,
    bTheme: theme,
    ganjiKo: ctx.ganjiKo,
    keywords: keywords.top,
    sajuWeight: keywords.sajuWeight,
    priorUniqueDays: keywords.priorUniqueDays,
    feedbackBiasApplied: keywords.feedbackBiasApplied,
    keywordBiases,
    decision: {
      focusCategory: decision.focusCategory,
      contentScore: decision.contentScore,
      topKeywords: decision.topKeywords,
      evidence: decision.evidence,
    },
    insightContext: {
      engineVersion: insight.engineVersion,
      dataCutoffAt: insight.dataCutoffAt,
      primaryKeyword: insight.primaryKeyword,
      tensionKeyword: insight.tensionKeyword,
      overallConfidence: insight.overallConfidence,
      priorUniqueDays: insight.priorUniqueDays,
    },
    isolation: {
      ragRole: "wording_only",
      ridgeRole: ridgeLive ? "live" : "shadow_or_off",
      ridgeLiveEnabled: ridgeLive,
      decisionBeforeRag: true,
      feedbackLearning: true,
    },
    ridgeShadow,
    leakageGuard: {
      excludedToday: true,
      priorEntryCount: priorEntries.length,
      rawEntryCount: rawEntries.length,
    },
  });
}
