"use client";

import type { TodayVibe } from "@/lib/diary/todayVibe";

type Props = {
  vibe: TodayVibe;
};

export default function TodayVibeLine({ vibe }: Props) {
  return (
    <div
      className="px-3 py-2 border-2 text-center"
      style={{
        borderColor: "#60a5fa",
        background: "color-mix(in srgb, #60a5fa 8%, var(--px-bg2))",
      }}
    >
      <p className="text-sm font-bold leading-snug" style={{ color: "var(--px-text-on-panel)" }}>
        {vibe.headline}
      </p>
      {vibe.detail && (
        <p className="ui-hint mt-1 leading-snug">{vibe.detail}</p>
      )}
    </div>
  );
}
