"use client";

import { useViewMode, type ViewMode } from "@/contexts/ViewModeContext";

const MODES: { id: ViewMode; label: string }[] = [
  { id: "desktop", label: "PC" },
  { id: "mobile", label: "모바일" },
];

export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();

  return (
    <div
      className="flex border-2"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
      role="group"
      aria-label="화면 모드 선택"
    >
      {MODES.map(({ id, label }) => {
        const active = viewMode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setViewMode(id)}
            className="px-2 py-1 text-[10px] font-bold border-r last:border-r-0"
            style={{
              color: active ? "var(--px-bg)" : "var(--px-text2)",
              background: active ? "var(--px-accent)" : "transparent",
              borderColor: "var(--px-border)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
