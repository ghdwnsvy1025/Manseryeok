"use client";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export default function ErrorState({
  title = "문제가 생겼어요",
  message,
  onRetry,
}: Props) {
  return (
    <div
      className="p-4 border-2 space-y-2"
      style={{ borderColor: "#f87171", background: "var(--px-bg2)" }}
      role="alert"
    >
      <p className="text-sm font-bold" style={{ color: "#f87171" }}>
        {title}
      </p>
      <p className="text-xs" style={{ color: "var(--px-text2)" }}>
        {message}
      </p>
      {onRetry && (
        <button type="button" className="ui-primary-btn px-3 py-2 text-xs" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
