"use client";

import Link from "next/link";
import { isNewAnalysisEnabled } from "@/lib/app/featureFlags";

/** Phase 5 — 분석 UI·서술 게이트 */
export default function AnalysisGate({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isNewAnalysisEnabled()) {
    return (
      <div
        className="p-4 border-2 space-y-3 max-w-md mx-auto"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          분석 화면이 꺼져 있어요
        </p>
        <p className="ui-hint">
          Phase 5 — 분석 UI·서술 플래그{" "}
          <code className="text-[11px]">NEXT_PUBLIC_FF_NEW_ANALYSIS=true</code>{" "}
          로 켤 수 있습니다. LLM 없이도 결정론적 요약을 씁니다 (
          <code className="text-[11px]">FF_ANALYSIS_NARRATIVE_LLM</code> 별도).
        </p>
        <Link href="/" className="underline font-bold text-sm">
          홈으로
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
