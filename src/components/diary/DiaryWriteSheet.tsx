"use client";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  disabled?: boolean;
  onAnalyze?: () => void;
  analyzing?: boolean;
};

export default function DiaryWriteSheet({
  open,
  value,
  onChange,
  onClose,
  disabled,
  onAnalyze,
  analyzing,
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
          ■ 일기 쓰기
        </p>
        <button
          type="button"
          onClick={onClose}
          className="ui-primary-btn px-3 py-1.5 text-xs"
          disabled={disabled}
        >
          완료
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">
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
            {analyzing ? "분석 중..." : "마음 AI 분석 (선택)"}
          </button>
        )}
      </div>
    </div>
  );
}
