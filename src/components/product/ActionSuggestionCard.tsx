"use client";

type Props = {
  action: string;
  reason?: string;
  onAccept?: () => void;
  onNext?: () => void;
  onReject?: () => void;
};

export default function ActionSuggestionCard({
  action,
  reason,
  onAccept,
  onNext,
  onReject,
}: Props) {
  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
    >
      <p className="ui-section-title">오늘의 한 가지 준비</p>
      <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        {action}
      </p>
      {reason && <p className="ui-hint">{reason}</p>}
      <div className="flex flex-wrap gap-2">
        {onAccept && (
          <button type="button" className="ui-primary-btn px-3 py-2 text-xs" onClick={onAccept}>
            내일 해볼게요
          </button>
        )}
        {onNext && (
          <button
            type="button"
            className="px-3 py-2 text-xs font-bold border"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            onClick={onNext}
          >
            다른 제안 보기
          </button>
        )}
        {onReject && (
          <button
            type="button"
            className="text-xs font-bold underline"
            style={{ color: "var(--px-text2)" }}
            onClick={onReject}
          >
            나와 맞지 않아요
          </button>
        )}
      </div>
    </div>
  );
}
