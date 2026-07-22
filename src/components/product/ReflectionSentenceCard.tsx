"use client";

import type { ReflectionSource } from "@/lib/product/lifeAreas";

type Props = {
  text: string;
  source: ReflectionSource;
  onSave?: () => void;
  onNext?: () => void;
  onReject?: () => void;
};

export default function ReflectionSentenceCard({
  text,
  source,
  onSave,
  onNext,
  onReject,
}: Props) {
  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
    >
      <p className="ui-section-title">오늘의 성찰 문장</p>
      <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        {text}
      </p>
      <p className="ui-hint">
        {source === "verified_quote"
          ? "검증된 인용입니다."
          : "생성된 성찰 문장입니다. 특정 인물의 명언이 아닙니다."}
      </p>
      <div className="flex flex-wrap gap-2">
        {onSave && (
          <button type="button" className="ui-primary-btn px-3 py-2 text-xs" onClick={onSave}>
            저장
          </button>
        )}
        {onNext && (
          <button
            type="button"
            className="px-3 py-2 text-xs font-bold border"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            onClick={onNext}
          >
            다른 문장
          </button>
        )}
        {onReject && (
          <button
            type="button"
            className="text-xs font-bold underline"
            style={{ color: "var(--px-text2)" }}
            onClick={onReject}
          >
            이 문장은 나와 맞지 않아요
          </button>
        )}
      </div>
    </div>
  );
}
