"use client";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  disabled?: boolean;
  onAnalyze?: () => void;
  analyzing?: boolean;
  analyzeLabel?: string;
};

export default function DiaryWriteSheet({
  open,
  value,
  onChange,
  onClose,
  disabled,
  onAnalyze,
  analyzing,
  analyzeLabel = "긴 일기 반영",
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "var(--px-bg)" }}
      role="dialog"
      aria-modal="true"
      aria-label="일기 쓰기"
    >
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b-2"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          ■ 긴 일기
        </p>
        <button
          type="button"
          onClick={onClose}
          className="ui-primary-btn px-3 py-1.5 text-xs"
          disabled={disabled}
        >
          닫기
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">
        <p className="ui-hint">원문은 외부로 전송되지 않고 사용자 저장소에만 남습니다.</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="오늘 하루는 어땠나요? 자유롭게 적어주세요."
          disabled={disabled}
          className="w-full flex-1 min-h-[50vh] px-3 py-3 text-sm border-2 resize-none"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
            color: "var(--px-text)",
          }}
          autoFocus
        />
        {onAnalyze && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={disabled || !value.trim()}
            className="ui-action-btn self-start text-xs"
          >
            {analyzing ? "처리 중..." : analyzeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
