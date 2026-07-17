"use client";

import { useState } from "react";
import ManualScoreInput from "@/components/diary/ManualScoreInput";
import type { ManualScoreState } from "@/lib/diary/manualScores";

type Props = {
  open: boolean;
  state: ManualScoreState;
  onChange: (state: ManualScoreState) => void;
  onClose: () => void;
  disabled?: boolean;
};

export default function ManualScoreSheet({
  open,
  state,
  onChange,
  onClose,
  disabled,
}: Props) {
  const [showTheory, setShowTheory] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.58)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-score-sheet-title"
    >
      <div
        className="w-full h-[82vh] sm:max-w-md sm:h-[720px] sm:max-h-[82vh] flex flex-col border-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "#60a5fa",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <div
          className="shrink-0 flex items-center justify-between gap-2 p-3 border-b-2"
          style={{ borderColor: "var(--px-border)" }}
        >
          <div className="flex items-center gap-2">
            <p
              id="manual-score-sheet-title"
              className="text-lg font-black"
              style={{ color: "#60a5fa" }}
            >
              세부 감정 조절
            </p>
            <button
              type="button"
              onClick={() => setShowTheory(true)}
              className="text-xs font-bold underline"
              style={{ color: "var(--px-text2)" }}
            >
              계산 근거 보기
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="ui-primary-btn px-3 py-1.5 text-xs"
          >
            완료
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <ManualScoreInput
            state={state}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      </div>

      {showTheory && (
        <div
          className="fixed inset-0 z-[230] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.68)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wellbeing-theory-title"
        >
          <div
            className="w-full max-w-sm p-4 border-2 space-y-3"
            style={{
              background: "var(--px-bg2)",
              borderColor: "var(--px-accent)",
              boxShadow: "4px 4px 0 #000",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p
                id="wellbeing-theory-title"
                className="text-base font-black"
                style={{ color: "var(--px-accent)" }}
              >
                행복도 항목의 이론적 근거
              </p>
              <button
                type="button"
                onClick={() => setShowTheory(false)}
                className="text-xs font-bold underline"
                style={{ color: "var(--px-text2)" }}
              >
                닫기
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                <strong>PERMA 웰빙 이론</strong><br />
                즐거움·몰입·관계·성취·의미를 웰빙의 핵심 요소로 봅니다.
              </p>
              <p>
                <strong>자기결정성이론</strong><br />
                스스로 선택하고 조절한다는 자율성을 중요한 심리 욕구로 봅니다.
              </p>
              <p>
                <strong>WHO-5 정신적 웰빙 지표</strong><br />
                긍정적인 기분, 편안함, 활력과 일상에 대한 관심을 참고합니다.
              </p>
            </div>
            <p className="ui-hint text-xs leading-relaxed">
              8개 항목을 같은 비중으로 평균합니다. 자기 점검을 위한 기록이며
              의료적 진단을 대신하지 않습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
