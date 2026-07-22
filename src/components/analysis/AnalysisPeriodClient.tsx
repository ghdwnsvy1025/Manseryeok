"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AnalysisViewPanel from "@/components/analysis/AnalysisViewPanel";
import TendencyThreeLines from "@/components/analysis/TendencyThreeLines";
import { assembleAnalysis } from "@/lib/analysis/assemble";
import type {
  AnalysisViewModel,
  PeriodType,
} from "@/lib/analysis/types";
import type { AnalysisNarrativeOutput } from "@/lib/analysis/narrativeContract";
import { isAnalysisNarrativeLlmEnabled } from "@/lib/app/featureFlags";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function rangeFor(
  period: PeriodType,
  end: string
): { start: string; end: string } {
  if (period === "daily") return { start: end, end };
  if (period === "weekly") return { start: addDays(end, -6), end };
  return { start: addDays(end, -29), end };
}

const emptyVm = (
  periodType: PeriodType,
  start: string,
  end: string,
  focus: string
): AnalysisViewModel =>
  assembleAnalysis({
    periodType,
    periodStart: start,
    periodEnd: end,
    focusDate: focus,
    categoryKey: "energy",
    categoryLabel: "에너지·활력",
    scores: [],
    tags: [],
    astrology: null,
    model: null,
  });

/**
 * Phase 5 — 분석 UI·서술: 원격 조립 API로 실제 사용자 데이터 로드
 */
export default function AnalysisPeriodClient({
  periodType,
}: {
  periodType: PeriodType;
}) {
  const [focusDate, setFocusDate] = useState(today);
  const [viewModel, setViewModel] = useState<AnalysisViewModel | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<AnalysisNarrativeOutput | null>(
    null
  );
  const [narrativeNote, setNarrativeNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const { start, end } = useMemo(
    () => rangeFor(periodType, focusDate),
    [periodType, focusDate]
  );

  const loadRemote = useCallback(async () => {
    setLoading(true);
    setNarrative(null);
    try {
      const res = await fetch("/api/analysis/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType,
          periodStart: start,
          periodEnd: end,
          focusDate,
          categoryKey: "energy",
          includePrivacyAudit: true,
        }),
      });
      if (res.status === 403) {
        setViewModel(emptyVm(periodType, start, end, focusDate));
        setLoadNote("분석 플래그가 꺼져 있거나 접근이 거부되었습니다.");
        return;
      }
      const data = await res.json();
      if (data.viewModel) {
        setViewModel(data.viewModel);
        const parts: string[] = [];
        if (data.authenticated === false) {
          parts.push("로그인되지 않음 — 개인 데이터 없이 fallback 표시");
        } else if (data.loadMeta) {
          parts.push(
            `원격 점수 ${data.loadMeta.scoreCount} · snapshot ${
              data.loadMeta.snapshotFound ? "있음" : "없음"
            } · model ${data.loadMeta.modelFound ? "있음" : "없음"}`
          );
        }
        if (data.privacyAudit && !data.privacyAudit.ok) {
          parts.push(`privacy audit: ${data.privacyAudit.reasons?.join(",")}`);
        }
        setLoadNote(parts.join(" · ") || null);
      } else {
        setViewModel(emptyVm(periodType, start, end, focusDate));
        setLoadNote(data.error || "조립 실패 — fallback");
      }
    } catch {
      setViewModel(emptyVm(periodType, start, end, focusDate));
      setLoadNote("네트워크 오류 — 결정론적 fallback");
    } finally {
      setLoading(false);
    }
  }, [periodType, start, end, focusDate]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  async function requestNarrative() {
    const vm = viewModel;
    if (!vm) return;
    if (!isAnalysisNarrativeLlmEnabled()) {
      setNarrative(null);
      setNarrativeNote(
        "LLM 서술 플래그가 OFF입니다. 결정론적 fallback 문장을 표시합니다."
      );
      return;
    }
    setBusy(true);
    setNarrativeNote(null);
    try {
      const res = await fetch("/api/analysis/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewModel: vm }),
      });
      const data = await res.json();
      if (data.output) {
        setNarrative(data.output);
        setNarrativeNote(
          data.source === "llm"
            ? "LLM 서술"
            : `fallback: ${(data.reasons || []).join(", ") || "deterministic"}`
        );
      }
    } catch {
      setNarrativeNote("서술 요청 실패 — 결정론적 문장 유지");
    } finally {
      setBusy(false);
    }
  }

  const title =
    periodType === "daily" ? "일간" : periodType === "weekly" ? "주간" : "월간";
  const displayVm = viewModel ?? emptyVm(periodType, start, end, focusDate);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/analysis" style={{ color: "var(--px-accent)" }}>
          분석
        </Link>
        <Link href="/analysis/daily" style={{ color: "var(--px-accent)" }}>
          일간
        </Link>
        <Link href="/analysis/weekly" style={{ color: "var(--px-accent)" }}>
          주간
        </Link>
        <Link href="/analysis/monthly" style={{ color: "var(--px-accent)" }}>
          월간
        </Link>
      </nav>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm space-y-1" style={{ color: "var(--px-muted)" }}>
          <span>{title} 기준일</span>
          <input
            type="date"
            className="block border px-2 py-1 text-sm"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg)",
              color: "var(--px-fg)",
            }}
            value={focusDate}
            onChange={(e) => setFocusDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="ui-primary-btn px-3 py-2 text-sm disabled:opacity-50"
          disabled={busy || loading}
          onClick={() => void requestNarrative()}
        >
          서술 갱신
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm border"
          style={{ borderColor: "var(--px-border)", color: "var(--px-fg)" }}
          disabled={loading}
          onClick={() => void loadRemote()}
        >
          다시 로드
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          원격 데이터 불러오는 중…
        </p>
      ) : null}
      {loadNote ? (
        <p className="text-xs" style={{ color: "var(--px-muted)" }}>
          {loadNote}
        </p>
      ) : null}
      {narrativeNote ? (
        <p className="text-xs" style={{ color: "var(--px-muted)" }}>
          {narrativeNote}
        </p>
      ) : null}

      <AnalysisViewPanel viewModel={displayVm} narrative={narrative} />
      <TendencyThreeLines />
    </div>
  );
}
