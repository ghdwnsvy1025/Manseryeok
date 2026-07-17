"use client";

import {
  EMOTION_LABEL_KO,
  type EmotionLabel,
} from "@/lib/diary/dimensions";

const VALENCE_MOOD_OPTIONS: { id: EmotionLabel; emoji: string }[] = [
  { id: "very_negative", emoji: "😢" },
  { id: "negative", emoji: "😔" },
  { id: "neutral", emoji: "😐" },
  { id: "positive", emoji: "🙂" },
  { id: "very_positive", emoji: "😄" },
];

const MIXED_MOOD_OPTION = { id: "mixed" as const, emoji: "🫠" };
const UNKNOWN_MOOD_OPTION = { id: "unknown" as const, emoji: "❓" };

type Props = {
  value: EmotionLabel | null;
  onChange: (mood: EmotionLabel | null) => void;
  disabled?: boolean;
};

export default function MoodChips({ value, onChange, disabled }: Props) {
  const renderMoodButton = (
    opt: { id: EmotionLabel; emoji: string },
    className: string
  ) => {
    const selected = value === opt.id;
    return (
      <button
        key={opt.id}
        type="button"
        disabled={disabled}
        onClick={() => onChange(selected ? null : opt.id)}
        className={`${className} border-2 text-center transition-transform active:translate-y-0.5`}
        style={{
          borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
          background: selected ? "var(--px-bg3)" : "var(--px-bg2)",
          boxShadow: selected ? "2px 2px 0 #000" : "none",
          opacity: disabled ? 0.6 : 1,
        }}
        aria-pressed={selected}
      >
        <span className="text-xl leading-none">{opt.emoji}</span>
        <span
          className="text-xs font-bold leading-tight"
          style={{ color: selected ? "var(--px-accent)" : "var(--px-text2)" }}
        >
          {EMOTION_LABEL_KO[opt.id]}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-1.5">
      <p className="ui-section-title">기분</p>
      <div className="grid grid-cols-5 gap-1">
        {VALENCE_MOOD_OPTIONS.map((opt) =>
          renderMoodButton(
            opt,
            "min-w-0 flex flex-col items-center gap-0.5 py-2 px-0.5"
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {renderMoodButton(
          MIXED_MOOD_OPTION,
          "w-full flex items-center justify-center gap-2 py-1.5 px-2"
        )}
        {renderMoodButton(
          UNKNOWN_MOOD_OPTION,
          "w-full flex items-center justify-center gap-2 py-1.5 px-2"
        )}
      </div>
    </div>
  );
}
