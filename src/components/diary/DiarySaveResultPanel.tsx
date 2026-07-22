"use client";

import { useState } from "react";
import Link from "next/link";
import InsightCard from "@/components/product/InsightCard";
import ActionSuggestionCard from "@/components/product/ActionSuggestionCard";
import ReflectionSentenceCard from "@/components/product/ReflectionSentenceCard";
import FeedbackButtons from "@/components/product/FeedbackButtons";
import PersonalizationLevelCard from "@/components/product/PersonalizationLevelCard";
import type { DiaryAnalysisResult } from "@/services/analysis";
import type { AnalysisFeedback } from "@/lib/product/lifeAreas";

type Props = {
  result: DiaryAnalysisResult;
  bLinkCopy?: string | null;
  onClose: () => void;
};

export default function DiarySaveResultPanel({ result, bLinkCopy, onClose }: Props) {
  const [feedback, setFeedback] = useState<AnalysisFeedback | null>(null);

  return (
    <div className="space-y-3 p-3 border-2" style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="ui-section-title">기록 저장 완료</p>
        <button
          type="button"
          className="text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
          onClick={onClose}
        >
          닫기
        </button>
      </div>

      {bLinkCopy && <p className="ui-hint">{bLinkCopy}</p>}

      <PersonalizationLevelCard
        level={result.personalization}
        recordCount={result.recordCount}
      />

      <InsightCard title="오늘의 마음" body={result.mindSummary} />

      <InsightCard
        title="글 사이에 나타난 신호"
        body={result.hiddenSignal.text}
        footnote={
          result.hiddenSignal.aiConnected
            ? "AI 가설입니다. 하나의 관점으로 참고해주세요."
            : "AI 분석 기능을 준비하고 있어요."
        }
      />
      <FeedbackButtons value={feedback} onChange={setFeedback} />

      <InsightCard title="오늘 나에게 필요했던 조건" body={result.neededCondition} />

      <ActionSuggestionCard
        action={result.oneAction.action}
        reason={result.oneAction.reason}
      />

      <ReflectionSentenceCard
        text={result.reflection.text}
        source={result.reflection.source}
      />

      <Link href="/" className="ui-primary-btn block w-full py-3 text-center text-sm">
        내일의 예보 미리보기 →
      </Link>
    </div>
  );
}
