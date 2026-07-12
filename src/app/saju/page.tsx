"use client";

import { useState } from "react";
import SajuForm from "@/components/SajuForm";
import SajuResult from "@/components/SajuResult";
import { calculateSaju } from "@/lib/saju/calculator";
import { saveBirthFromSajuResult } from "@/lib/diary/sajuSettings";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuInput, SajuResult as SajuResultType } from "@/lib/saju/types";

export default function SajuPage() {
  const { isMobile } = useViewMode();
  const [result, setResult] = useState<SajuResultType | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCalculate = (input: SajuInput) => {
    setResult(null);
    setError(null);
    setIsLoading(true);
    try {
      const res = calculateSaju(input);
      saveBirthFromSajuResult(res);
      setResultKey((k) => k + 1);
      setResult(res);
      setTimeout(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-6 sm:space-y-8 ${isMobile ? "space-y-5" : ""}`}>
      <div className="text-center space-y-3 sm:space-y-4">
        <div
          className="inline-block px-3 sm:px-4 py-2 border-2 text-sm font-bold pixel-font"
          style={{
            fontSize: isMobile ? "8px" : "10px",
            color: "var(--px-accent)",
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "4px 4px 0 #4a3a00",
            letterSpacing: "0.1em",
          }}
        >
          ★ 내 사주 ★
        </div>
        <p className="ui-page-intro max-w-md mx-auto">
          생년월일시를 입력하면 <strong style={{ color: "var(--px-text)" }}>사주팔자와 대운</strong>을 계산합니다.
        </p>
      </div>

      <div>
        <div
          className="px-3 py-1.5 text-xs font-bold border-2 border-b-0 inline-block"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border2)",
            color: "var(--px-accent)",
          }}
        >
          ▼ 입력
        </div>
        <SajuForm onCalculate={handleCalculate} isLoading={isLoading} />
      </div>

      {error && (
        <div
          className="border-2 px-4 py-4"
          style={{
            borderColor: "#f87171",
            background: "#1a0a0a",
            boxShadow: "4px 4px 0 #7f1d1d",
            color: "#f87171",
          }}
        >
          <p className="text-sm font-bold mb-1">■ 오류</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div id="result-section">
          <div
            className="px-3 py-1.5 text-xs font-bold border-2 border-b-0 inline-block"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-accent)",
              color: "var(--px-accent)",
            }}
          >
            ★ 결과
          </div>
          <SajuResult key={resultKey} result={result} />
        </div>
      )}

      {!result && !error && (
        <div className={`grid gap-3 sm:gap-4 mt-2 ${isMobile ? "grid-cols-1" : "sm:grid-cols-3"}`}>
          {[
            {
              icon: "📅",
              title: "절기 기준 계산",
              desc: "월주는 절기(절입 시각) 기준으로 계산합니다. 고정 날짜가 아닌 천문 계산으로 정확한 절기 시각을 사용합니다.",
            },
            {
              icon: "🌙",
              title: "음력 지원",
              desc: "음력 입력 시 검증된 DB를 통해 양력으로 변환합니다. 윤달 여부도 지원합니다.",
            },
            {
              icon: "🔍",
              title: "계산 근거 제공",
              desc: "입춘 시각, 절기 경계, JDN 등 계산 근거를 상세히 제공하여 결과를 신뢰할 수 있습니다.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="px-card p-4 space-y-2">
              <div className="text-2xl">{icon}</div>
              <h3 className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
                {title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
