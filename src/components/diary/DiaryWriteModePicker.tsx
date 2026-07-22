"use client";

import type { DiaryWriteMode } from "@/lib/product/lifeAreas";

const OPTIONS: Array<{ id: DiaryWriteMode; label: string; hint: string }> = [
  { id: "quick", label: "빠른 체크인", hint: "10초" },
  { id: "oneline", label: "한 줄 기록", hint: "기분+메모" },
  { id: "free", label: "자유 일기", hint: "긴 글" },
];

type Props = {
  value: DiaryWriteMode;
  onChange: (mode: DiaryWriteMode) => void;
};

export default function DiaryWriteModePicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="기록 방식">
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="px-2 py-2 border-2 text-center"
            style={{
              borderColor: active ? "var(--px-accent)" : "var(--px-border)",
              background: "var(--px-bg3)",
              color: active ? "var(--px-accent)" : "var(--px-text2)",
            }}
            aria-pressed={active}
          >
            <span className="block text-xs font-black">{opt.label}</span>
            <span className="block text-[10px] font-bold mt-0.5 opacity-80">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
