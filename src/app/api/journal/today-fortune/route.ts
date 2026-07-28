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
import { FORTUNE_SCORE_VERSION } from "@/lib/journal/fortune/score";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { SajuProfile } from "@/lib/diary/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  isDailyFortuneV2Enabled,
  isFortuneDetailsEnabled,
} from "@/lib/app/featureFlags";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveSajuProfileId } from "@/lib/diary/activeSajuProfile";
import { loadOnboardingProfile } from "@/lib/journal/onboarding/load";
import { computeBlendWeights } from "@/lib/journal/insight/dynamicWeights";
import { buildFortuneEvidence } from "@/lib/journal/fortune/evidence";
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { resolveInsightPersistClient } from "@/lib/journal/insight/persistClient";
import { totalJournalXp } from "@/lib/product/personalizationLevel";

function withNatalDay(
  insight: ReturnType<typeof buildDailyInsightContext>,
  sajuProfile: SajuProfile | null | undefined
) {
  if (insight.natalDay) return insight;
  return {
    ...insight,
    natalDay: buildNatalDayInsight(insight.eventDate, sajuProfile ?? null),
  };
}

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
  const totalXp = totalJournalXp(entries);

  if (isDailyFortuneV2Enabled()) {
    const sbAuth = getSupabaseServerClient();
    let userId: string | null = null;
    let sajuProfileId: string | null = null;
    let onboardingCompleted = false;
    let sb = sbAuth;
    if (sbAuth) {
      const {
        data: { user },
      } = await sbAuth.auth.getUser();
      userId = user?.id ?? null;
      if (userId) {
        sb = resolveInsightPersistClient(sbAuth);
        sajuProfileId =
          b.sajuProfile?.id ??
          (await resolveActiveSajuProfileId(sb, userId));
        if (sajuProfileId) {
          onboardingCompleted = (
            await loadOnboardingProfile(sb, userId, sajuProfileId)
          ).completed;
          const cached = await loadPersistedFortune(
            sb,
            userId,
            b.todayDate,
            sajuProfileId
          );
          // 점수 엔진 버전이 바뀌면 캐시 무시 → 원국×일진 로직 재계산
          const cacheUsable =
            cached &&
            cached.sections.length > 0 &&
            cached.scoringVersion === FORTUNE_SCORE_VERSION;
          if (cacheUsable) {
            const overall =
              cached.sections.find((s) => s.domain === "overall") ??
              cached.sections[0]!;
            const domains = cached.sections.filter(
              (s) => s.domain !== "overall"
            );

            if (!skipLlm) {
              const insightRaw =
                (await loadPersistedInsightContext(
                  sb,
                  userId,
                  b.todayDate,
                  sajuProfileId
                )) ??
                buildDailyInsightContext({
                  eventDate: b.todayDate,
                  entries,
                  enabledCodes,
                  sajuProfile: b.sajuProfile ?? null,
                });
              const insight = withNatalDay(insightRaw, b.sajuProfile);
              const polished = await generateTodayFortuneV2(insight, {
                skipLlm: false,
                onboardingCompleted,
                totalXp,
              });
              await updateFortuneWording(sb, {
                userId,
                sajuProfileId,
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
                evidence: buildFortuneEvidence(insight, {
                  onboardingCompleted,
                  totalXp,
                }),
                contextId: cached.contextId,
                detailsEnabled: isFortuneDetailsEnabled(),
                cached: true,
                wordingRefreshed: true,
              });
            }

            const cachedInsightRaw = await loadPersistedInsightContext(
              sb,
              userId,
              b.todayDate,
              sajuProfileId
            );
            const cachedInsight = cachedInsightRaw
              ? withNatalDay(cachedInsightRaw, b.sajuProfile)
              : null;
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
              insight: cachedInsight,
              evidence: cachedInsight
                ? buildFortuneEvidence(cachedInsight, {
                    onboardingCompleted,
                    totalXp,
                  })
                : null,
              contextId: cached.contextId,
              detailsEnabled: isFortuneDetailsEnabled(),
              cached: true,
            });
          }
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

    if (sb && userId && sajuProfileId) {
      const resolved = await resolveDailyInsightContext(sb, userId, {
        eventDate: b.todayDate,
        entries,
        enabledCodes,
        sajuProfile: b.sajuProfile ?? null,
        sajuProfileId,
      });
      if (resolved) {
        insight = resolved.ctx;
        contextId = resolved.id;
      }
    }

    const result = await generateTodayFortuneV2(insight, {
      skipLlm,
      onboardingCompleted,
      totalXp,
    });
    const blendWeights = computeBlendWeights({
      totalXp,
      onboardingCompleted,
    });

    // skipLlm이어도 컨텍스트·점수 스냅샷은 반드시 저장
    if (sb && userId && sajuProfileId) {
      if (!contextId) {
        const resolved = await resolveDailyInsightContext(sb, userId, {
          eventDate: b.todayDate,
          entries,
          enabledCodes,
          sajuProfile: b.sajuProfile ?? null,
          sajuProfileId,
        });
        if (resolved) {
          insight = resolved.ctx;
          contextId = resolved.id;
        }
      }
      await persistFortune(sb, {
        userId,
        sajuProfileId,
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
      evidence: buildFortuneEvidence(insight, {
        onboardingCompleted,
        totalXp,
        weights: blendWeights,
      }),
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
