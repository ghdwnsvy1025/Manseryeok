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
import { resolveGatedBlend } from "@/lib/journal/insight/recordReflectGate";
import { buildFortuneEvidence } from "@/lib/journal/fortune/evidence";
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { resolveInsightPersistClient } from "@/lib/journal/insight/persistClient";
import { totalJournalXp } from "@/lib/product/personalizationLevel";
import { requireAuthUser } from "@/lib/api/requireAuth";
import { checkLlmRateLimit } from "@/lib/api/rateLimit";
import type { DailyInsightContext } from "@/lib/journal/insight/types";
import { sajuProfileFortuneFingerprint } from "@/lib/journal/fortune/profileFingerprint";

export const runtime = "nodejs";

type Body = {
  todayDate?: string;
  sajuProfile?: SajuProfile | null;
  entries?: JournalEntry[];
  enabledCodes?: string[];
  /** true면 LLM 문장만 생략 — 점수·컨텍스트는 반드시 저장 */
  skipLlm?: boolean;
  /** true면 당일 캐시만 조회. 없으면 생성하지 않음 */
  cacheOnly?: boolean;
};

function withNatalDay(
  insight: DailyInsightContext,
  sajuProfile: SajuProfile | null | undefined
): DailyInsightContext {
  // 프로필 생일 변경 시에도 항상 현재 원국×오늘로 재계산 (캐시 insight의 낡은 natal 방지)
  return {
    ...insight,
    natalDay: buildNatalDayInsight(insight.eventDate, sajuProfile ?? null),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthUser();
  if (!auth.ok) return auth.response;

  try {
    return await handleTodayFortune(req, auth.user.id);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[today-fortune]", detail);
    return Response.json(
      { error: "오늘의 운세 생성 중 오류가 났어요.", detail },
      { status: 500 }
    );
  }
}

async function handleTodayFortune(req: NextRequest, authUserId: string) {
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
  const cacheOnly = Boolean(b.cacheOnly);
  const totalXp = totalJournalXp(entries);

  if (isDailyFortuneV2Enabled()) {
    const sbAuth = getSupabaseServerClient();
    let userId: string | null = authUserId;
    let sajuProfileId: string | null = null;
    let onboardingCompleted = false;
    let sb = sbAuth;
    if (sbAuth) {
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
        const profileFp = sajuProfileFortuneFingerprint(b.sajuProfile);
        // 점수 엔진·사주 생일/일주가 바뀌면 캐시 무시
        const cacheUsable =
          cached &&
          cached.sections.length > 0 &&
          cached.scoringVersion === FORTUNE_SCORE_VERSION &&
          (cached.profileFingerprint ?? null) === profileFp;
        if (cacheUsable) {
          // 당일 1회 생성 후엔 LLM 재호출 없이 그대로 반환
          const overall =
            cached.sections.find((s) => s.domain === "overall") ??
            cached.sections[0]!;
          const domains = cached.sections.filter(
            (s) => s.domain !== "overall"
          );
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
              interpretation:
                cached.overallSummary ||
                overall.interpretation ||
                overall.summary,
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
        if (cacheOnly) {
          return Response.json({
            version: "v2",
            cached: false,
            overall: null,
            domains: [],
          });
        }
      }
      if (cacheOnly) {
        return Response.json({
          version: "v2",
          cached: false,
          overall: null,
          domains: [],
        });
      }
    }
    if (cacheOnly) {
      return Response.json({
        version: "v2",
        cached: false,
        overall: null,
        domains: [],
      });
    }

    // 캐시 미스일 때만 LLM 한도 적용
    if (!skipLlm) {
      const limited = checkLlmRateLimit(authUserId);
      if (!limited.ok) return limited.response;
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
      sajuProfile: b.sajuProfile ?? null,
    });
    const blendWeights = resolveGatedBlend({
      totalXp,
      onboardingCompleted,
      priorUniqueDays: insight.priorUniqueDays ?? 0,
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
        profileFingerprint: sajuProfileFortuneFingerprint(b.sajuProfile),
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

  const limited = checkLlmRateLimit(authUserId);
  if (!limited.ok) return limited.response;

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
