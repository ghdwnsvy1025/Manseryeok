"use client";

import Link from "next/link";
import AnalysisGate from "@/components/analysis/AnalysisGate";

export default function AnalysisIndexPage() {
  return (
    <AnalysisGate>
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <header className="space-y-2">
          <p
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: "var(--px-muted)" }}
          >
            Phase 5 — 분석 UI·서술
          </p>
          <h1 className="text-xl font-bold" style={{ color: "var(--px-fg)" }}>
            분석
          </h1>
          <p className="text-sm" style={{ color: "var(--px-muted)" }}>
            명리 이론상 · 내 기록상 · 실천 제안을 분리해 보여 줍니다. 숫자는
            결정론적 조립기가 확정하고, LLM은 문장만 돕습니다.
          </p>
        </header>
        <ul className="space-y-3">
          {[
            { href: "/analysis/daily", label: "일간 분석" },
            { href: "/analysis/weekly", label: "주간 분석" },
            { href: "/analysis/monthly", label: "월간 분석" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg border p-4 font-bold"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg2)",
                  color: "var(--px-fg)",
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AnalysisGate>
  );
}
