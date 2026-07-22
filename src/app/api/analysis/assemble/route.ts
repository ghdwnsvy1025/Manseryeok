import { NextResponse } from "next/server";
import { assembleAnalysis } from "@/lib/analysis/assemble";
import { loadRemoteAssembleInput } from "@/lib/analysis/loadRemoteContext";
import { auditViewModelPrivacy } from "@/lib/analysis/privacyAudit";
import type { AssembleInput, PeriodType } from "@/lib/analysis/types";
import { isNewAnalysisEnabled } from "@/lib/app/featureFlags";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Phase 5 — 분석 UI·서술: 결정론적 조립
 * - body.assembleInput: 직접 입력 (테스트)
 * - body.periodType + dates: 세션 사용자 원격 로드
 * 응답에 userId를 넣지 않음.
 */
export async function POST(req: Request) {
  if (!isNewAnalysisEnabled()) {
    return NextResponse.json({ error: "analysis_flag_off" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      assembleInput?: AssembleInput;
      periodType?: PeriodType;
      periodStart?: string;
      periodEnd?: string;
      focusDate?: string;
      categoryKey?: string;
      includePrivacyAudit?: boolean;
    };

    let assembleInput: AssembleInput;
    let authenticated = true;
    let loadMeta: Record<string, unknown> | undefined;

    if (body.assembleInput?.periodType) {
      assembleInput = {
        ...body.assembleInput,
        scores: body.assembleInput.scores || [],
      };
    } else if (body.periodType && body.periodStart && body.periodEnd) {
      const sb = getSupabaseServerClient();
      if (!sb) {
        return NextResponse.json(
          { error: "supabase_not_configured" },
          { status: 503 }
        );
      }
      const loaded = await loadRemoteAssembleInput(sb, {
        periodType: body.periodType,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        focusDate: body.focusDate,
        categoryKey: body.categoryKey || "energy",
      });
      assembleInput = loaded.assembleInput;
      authenticated = loaded.authenticated;
      loadMeta = {
        authenticated: loaded.authenticated,
        scoreCount: loaded._audit?.scoreCount ?? 0,
        snapshotFound: loaded._audit?.snapshotFound ?? false,
        modelFound: loaded._audit?.modelFound ?? false,
        loadError: loaded.error ?? null,
      };
      if (!loaded.ok && loaded.error && loaded.error !== "unauthenticated") {
        return NextResponse.json(
          { error: loaded.error, loadMeta },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const viewModel = assembleAnalysis(assembleInput);
    const privacy = body.includePrivacyAudit
      ? auditViewModelPrivacy(viewModel)
      : undefined;

    return NextResponse.json({
      viewModel,
      authenticated,
      loadMeta,
      privacyAudit: privacy
        ? { ok: privacy.ok, reasons: privacy.reasons }
        : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "assemble_failed" },
      { status: 500 }
    );
  }
}
