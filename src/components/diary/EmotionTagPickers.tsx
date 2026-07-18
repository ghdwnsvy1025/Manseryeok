"use client";

import {
  RECOMMENDED_EMOTION_TAGS,
  RECOMMENDED_EVENT_TAGS,
} from "@/lib/diary/emotionTags";

type EmotionProps = {
  value: string[];
  onChange: (emotions: string[]) => void;
  disabled?: boolean;
};

export function EmotionMultiSelect({ value, onChange, disabled }: EmotionProps) {
  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }
    onChange([...value, tag]);
  };

  return (
    <div className="space-y-2">
      <p className="ui-section-title">감정</p>
      <div className="flex flex-wrap gap-1.5">
        {RECOMMENDED_EMOTION_TAGS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => toggle(tag)}
              className="px-2.5 py-1.5 border text-xs font-bold"
              style={{
                borderColor: selected ? "#60a5fa" : "var(--px-border)",
                background: selected
                  ? "color-mix(in srgb, #60a5fa 14%, var(--px-bg2))"
                  : "var(--px-bg3)",
                color: selected ? "#60a5fa" : "var(--px-text2)",
              }}
            >
              {selected ? "✓ " : ""}
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TagProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

export function EventTagPicker({ value, onChange, disabled }: TagProps) {
  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }
    onChange([...value, tag]);
  };

  const addCustom = () => {
    if (disabled) return;
    const next = window.prompt("추가할 태그를 입력하세요");
    if (!next) return;
    const trimmed = next.trim().slice(0, 40);
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="ui-section-title">태그</p>
        <button
          type="button"
          onClick={addCustom}
          disabled={disabled}
          className="text-xs font-bold underline"
          style={{ color: "var(--px-text2)" }}
        >
          + 직접 추가
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {RECOMMENDED_EVENT_TAGS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => toggle(tag)}
              className="px-2.5 py-1.5 border text-xs font-bold"
              style={{
                borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
                background: selected
                  ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg2))"
                  : "var(--px-bg3)",
                color: selected ? "var(--px-accent)" : "var(--px-text2)",
              }}
            >
              {selected ? "✓ " : ""}
              {tag}
            </button>
          );
        })}
        {value
          .filter((tag) => !(RECOMMENDED_EVENT_TAGS as readonly string[]).includes(tag))
          .map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => toggle(tag)}
              className="px-2.5 py-1.5 border text-xs font-bold"
              style={{
                borderColor: "var(--px-accent)",
                background: "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg2))",
                color: "var(--px-accent)",
              }}
            >
              ✓ {tag}
            </button>
          ))}
      </div>
    </div>
  );
}
