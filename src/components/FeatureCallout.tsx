"use client";

type Props = {
  message: string;
  onDismiss: () => void;
};

export default function FeatureCallout({ message, onDismiss }: Props) {
  return (
    <div className="ui-feature-callout" role="note">
      <p className="ui-guide flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ui-hint font-bold shrink-0 px-1 py-0.5"
        style={{ color: "var(--px-text2)" }}
        aria-label="안내 닫기"
      >
        닫기
      </button>
    </div>
  );
}
