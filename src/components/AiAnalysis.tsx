"use client";

import { useState } from "react";
import type { SajuResult } from "@/lib/saju/types";

interface AiAnalysisProps {
  result: SajuResult;
}

type AnalysisStatus = "idle" | "loading" | "done" | "error";

export default function AiAnalysis({ result }: AiAnalysisProps) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [analysis, setAnalysis] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [question, setQuestion] = useState<string>("");

  const handleAnalyze = async () => {
    setStatus("loading");
    setAnalysis("");
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sajuResult: result,
          question: question.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "알 수 없는 오류");
        return;
      }

      setStatus("done");
      setAnalysis(data.analysis ?? "");
    } catch {
      setStatus("error");
      setError("서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setAnalysis("");
    setError("");
    setQuestion("");
  };

  return (
    <div
      className="p-3 space-y-4"
      style={{
        background: "var(--px-bg3)",
        border: "2px solid var(--px-accent)",
        boxShadow: "3px 3px 0 #4a3a00",
      }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
        ★ AI 사주 분석
      </p>

      {status === "idle" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="예: 직업운이 어떤가요? / 올해 운세는? / 배우자운을 알려주세요."
              rows={2}
              className="w-full p-2 text-xs border"
              style={{
                background: "var(--px-bg2)",
                borderColor: "var(--px-border)",
                color: "var(--px-text)",
                resize: "vertical",
                outline: "none",
              }}
            />
            <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
              비워두면 종합 분석을 해드립니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            className="px-btn w-full py-2.5 text-sm"
          >
            [ ★ AI 분석하기 ]
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
            ◈ 분석 중...
          </p>
          <p className="text-xs" style={{ color: "var(--px-text2)" }}>
            학습된 자료에서 관련 내용을 검색하고 있습니다.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <div
            className="p-3 border text-xs"
            style={{ borderColor: "#f87171", background: "#1a0a0a", color: "#f87171" }}
          >
            <p className="font-bold mb-1">■ 오류 발생</p>
            <p>{error}</p>
            {error.includes("관리자") && (
              <p className="mt-2">
                →{" "}
                <a href="/admin" style={{ color: "var(--px-accent)", textDecoration: "underline" }}>
                  /admin 페이지
                </a>
                에서 텍스트를 먼저 학습시켜주세요.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-btn w-full py-2 text-xs"
          >
            [ 다시 시도 ]
          </button>
        </div>
      )}

      {status === "done" && analysis && (
        <div className="space-y-3">
          <div
            className="p-4 border text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: "var(--px-bg2)",
              borderColor: "var(--px-border2)",
              color: "var(--px-text)",
            }}
          >
            {analysis}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-btn flex-1 py-2 text-xs"
            >
              [ 새로 분석하기 ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
