"use client";

import Link from "next/link";
import { useState } from "react";
import SajuForm from "@/components/SajuForm";
import SajuResult from "@/components/SajuResult";
import { useViewMode } from "@/contexts/ViewModeContext";
import type { SajuInput, SajuResult as SajuResultType } from "@/lib/saju/types";
import { calculateSaju } from "@/lib/saju/calculator";

/**
 * 다른 사람(또는 임시) 생년월일 조회.
 * 내 프로필에는 저장하지 않는다.
 */
export default function OtherSajuPage() {
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
      setResultKey((k) => k + 1);
      setResult(res);
      setTimeout(() => {
        document
          .getElementById("result-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-6 sm:space-y-8 ${isMobile ? "space-y-5" : ""}`}>
      <div className="text-center space-y-3 sm:space-y-4">
        <div
          className="inline-block px-3 sm:px-4 py-2 border-2 text-[15px] font-bold display-font"
          style={{
            color: "var(--px-accent)",
            borderColor: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "4px 4px 0 #4a3a00",
            letterSpacing: "0.1em",
          }}
        >
          ★ 다른 프로필 보기 ★
        </div>
        <p className="ui-page-intro max-w-md mx-auto">
          생년월일을 입력해 만세력만 봅니다.
          <br />
          <strong style={{ color: "var(--px-text)" }}>내 프로필에는 저장되지 않아요.</strong>
        </p>
      </div>

      <div id="saju-form">
        <div
          className="px-3 py-1.5 text-xs font-bold border-2 border-b-0 inline-block"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border2)",
            color: "var(--px-accent)",
          }}
        >
          ▼ 입력 · 조회만
        </div>
        <SajuForm
          onCalculate={(input) => handleCalculate(input)}
          isLoading={isLoading}
          prefillBirth={false}
          showNameField={false}
        />
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
            ★ 만세력 상세
          </div>
          <SajuResult key={resultKey} result={result} />
        </div>
      )}

      <div className="text-center">
        <Link
          href="/saju"
          className="text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
        >
          내 사주로 돌아가기
        </Link>
      </div>
    </div>
  );
}
