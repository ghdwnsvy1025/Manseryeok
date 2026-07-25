import { NextRequest } from "next/server";
import { isCategoryCode } from "@/lib/journal/categoryCatalog";
import { buildBTheme } from "@/lib/journal/bTheme";
import {
  generateTodayFortune,
  generateTodayFortuneV2,
} from "@/lib/journal/todayFortune";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import {
  loadPersistedFortune,
  loadPersistedInsightContext,
  persistFortune,
  updateFortuneWording,
} from "@/lib/journal/insight/persist";
import { resolveDailyInsightContext } from "@/lib/journal/insight/contextService";
import { FORTUNE_DOMAIN_TITLES } from "@/lib/journal/fortune/domains";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  isDailyFortuneV2Enabled,
  isFortuneDetailsEnabled,
} from "@/lib/app/featureFlags";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadOnboardingProfile } from "@/lib/journal/onboarding/load";
import { computeBlendWeights } from "@/lib/journal/insight/dynamicWeights";

export const runtime = "nodejs";

type Body = {
  todayDate?: string;
  sajuProfile?: SajuProfile | null;
  entries?: JournalEntry[];
  enabledCodes?: string[];
  /** true면 LLM 문장만 생략 — 점수·컨텍스트는 반드시 저장 */
  skipLlm?: boolean;
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

  const enabledCodes = (Array.isArray(b.enabledCodes) ? b.enabledCodes : [])
    .filter(isCategoryCode) as CategoryCode[];
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const skipLlm = Boolean(b.skipLlm);

  if (isDailyFortuneV2Enabled()) {
    const sb = getSupabaseServerClient();
    let userId: string | null = null;
    let onboardingCompleted = false;
    if (sb) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      userId = user?.id ?? null;
      if (userId) {
        onboardingCompleted = (await loadOnboardingProfile(sb, userId))
          .completed;
        const cached = await loadPersistedFortune(sb, userId, b.todayDate);
        if (cached && cached.sections.length > 0) {
          const overall =
            cached.sections.find((s) => s.domain === "overall") ??
            cached.sections[0]!;
          const domains = cached.sections.filter((s) => s.domain !== "overall");

          if (!skipLlm) {
            const insight =
              (await loadPersistedInsightContext(sb, userId, b.todayDate)) ??
              buildDailyInsightContext({
                eventDate: b.todayDate,
                entries,
                enabledCodes,
                sajuProfile: b.sajuProfile ?? null,
              });
            const polished = await generateTodayFortuneV2(insight, {
              skipLlm: false,
              onboardingCompleted,
            });
            await updateFortuneWording(sb, {
              userId,
              eventDate: b.todayDate,
              overall: polished.overall,
              domains: polished.domains,
              modelVersion:
                process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
            });
            return Response.json({
              version: "v2",
              overall: {
                ...polished.overall,
                title: FORTUNE_DOMAIN_TITLES.overall,
              },
              domains: polished.domains.map((d) => ({
                ...d,
                title: FORTUNE_DOMAIN_TITLES[d.domain] ?? d.title,
              })),
              scoringVersion: cached.scoringVersion,
              openAi: polished.openAi,
              theoryUsed: polished.theoryUsed,
              theoryEvidence: polished.theoryEvidence,
              insight,
              contextId: cached.contextId,
              detailsEnabled: isFortuneDetailsEnabled(),
              cached: true,
              wordingRefreshed: true,
            });
          }

          return Response.json({
            version: "v2",
            overall: {
              ...overall,
              title: FORTUNE_DOMAIN_TITLES.overall,
              headline: cached.overallHeadline || overall.headline,
              summary: cached.overallSummary || overall.summary,
            },
            domains: domains.map((d) => ({
              ...d,
              title: FORTUNE_DOMAIN_TITLES[d.domain] ?? d.title,
            })),
            scoringVersion: cached.scoringVersion,
            openAi: { kind: "skipped", detail: "cached_fortune" },
            theoryUsed: false,
            theoryEvidence: [],
            insight: await loadPersistedInsightContext(sb, userId, b.todayDate),
            contextId: cached.contextId,
            detailsEnabled: isFortuneDetailsEnabled(),
            cached: true,
          });
        }
      }
    }

    let insight = buildDailyInsightContext({
      eventDate: b.todayDate,
      entries,
      enabledCodes,
      sajuProfile: b.sajuProfile ?? null,
    });
    let contextId: string | null = null;

    if (sb && userId) {
      const resolved = await resolveDailyInsightContext(sb, userId, {
        eventDate: b.todayDate,
        entries,
        enabledCodes,
        sajuProfile: b.sajuProfile ?? null,
      });
      if (resolved) {
        insight = resolved.ctx;
        contextId = resolved.id;
      }
    }

    const result = await generateTodayFortuneV2(insight, {
      skipLlm,
      onboardingCompleted,
    });
    const blendWeights = computeBlendWeights({
      priorUniqueDays: insight.priorUniqueDays,
      onboardingCompleted,
    });

    // skipLlm이어도 컨텍스트·점수 스냅샷은 반드시 저장
    if (sb && userId) {
      if (!contextId) {
        const resolved = await resolveDailyInsightContext(sb, userId, {
          eventDate: b.todayDate,
          entries,
          enabledCodes,
          sajuProfile: b.sajuProfile ?? null,
        });
        if (resolved) {
          insight = resolved.ctx;
          contextId = resolved.id;
        }
      }
      await persistFortune(sb, {
        userId,
        eventDate: b.todayDate,
        contextId,
        overall: result.overall,
        domains: result.domains,
        scoringVersion: result.scoringVersion,
        modelVersion: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
        dataCutoffAt: insight.dataCutoffAt,
      });
    }

    return Response.json({
      ...result,
      ganjiKo: insight.ganjiKo,
      bTheme: insight.bTheme,
      contextId,
      blendWeights,
      detailsEnabled: isFortuneDetailsEnabled(),
      cached: false,
    });
  }

  const ctx = buildDailySajuContext(b.todayDate, b.sajuProfile ?? null);
  const theme = buildBTheme(ctx);
  const result = await generateTodayFortune(theme, { ganjiKo: ctx.ganjiKo });

  return Response.json({
    ...result,
    version: "v1",
    ganjiKo: ctx.ganjiKo,
    bTheme: theme,
  });
}

