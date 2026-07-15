"use client";

import {
  EMOTION_LABEL_KO,
  type EmotionLabel,
} from "@/lib/diary/dimensions";

const MOOD_OPTIONS: { id: EmotionLabel; emoji: string }[] = [
  { id: "very_positive", emoji: "😄" },
  { id: "positive", emoji: "🙂" },
  { id: "neutral", emoji: "😐" },
  { id: "mixed", emoji: "🫠" },
  { id: "negative", emoji: "😔" },
  { id: "very_negative", emoji: "😢" },
];

type Props = {
  value: EmotionLabel | null;
  onChange: (mood: EmotionLabel) => void;
  disabled?: boolean;
};

export default function MoodChips({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="ui-section-title">기분</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {MOOD_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className="flex flex-col items-center gap-0.5 py-2 px-1 border-2 text-center transition-transform active:translate-y-0.5"
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
                className="text-[10px] font-bold leading-tight"
                style={{ color: selected ? "var(--px-accent)" : "var(--px-text2)" }}
              >
                {EMOTION_LABEL_KO[opt.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
