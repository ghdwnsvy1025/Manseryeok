import { NextResponse } from "next/server";
import { generateAnalysisNarrative } from "@/lib/analysis/narrative";
import type { AnalysisViewModel } from "@/lib/analysis/types";
import { isNewAnalysisEnabled } from "@/lib/app/featureFlags";

/**
 * Phase 5 — 분석 UI·서술: LLM 서술 API
 * 입력 ViewModel의 숨김 필드는 generate 쪽에서 narrative input 구축 시 제외.
 */
export async function POST(req: Request) {
  if (!isNewAnalysisEnabled()) {
    return NextResponse.json(
      { error: "analysis_flag_off" },
      { status: 403 }
    );
  }
  try {
    const body = (await req.json()) as { viewModel?: AnalysisViewModel };
    if (!body.viewModel?.periodType) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    // 클라이언트가 prediction을 강제해도 서버에서 exposure 재확인은 assemble 재실행이 이상적.
    // 여기서는 ViewModel의 modelExposureAllowed / predictionVisible 를 신뢰하되
    // narrative builder가 숨김 값을 넣지 않음.
    const result = await generateAnalysisNarrative(body.viewModel);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "narrative_failed" },
      { status: 500 }
    );
  }
}
