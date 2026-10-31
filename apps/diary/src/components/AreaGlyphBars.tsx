"use client";

import { useState } from "react";
import { Bars } from "@/components/GlyphBars";
import type { AreaGlyphs } from "@/lib/stats/ganji";

/**
 * 영역별 "글자별 행복도" (2026-10-31 사용자 Q4 = b): 영역 칩을 고르면 그 영역 점수(10점 기준)를 천간·지지·오행 막대로.
 * 매긴 날이 있는 영역만 칩으로 보인다. 막대 모양은 글자별 내 행복도와 같은 .bars.
 */
export function AreaGlyphBars({ areas }: { areas: AreaGlyphs[] }) {
  const usable = areas.filter((a) => a.n > 0);
  const [key, setKey] = useState(usable[0]?.key);
  if (usable.length === 0) return null;
  const cur = usable.find((a) => a.key === key) ?? usable[0]!;
  return (
    <div className="area-glyphs flex flex-col gap-5">
      <div className="area-glyphs__chips flex flex-wrap gap-1.5" role="radiogroup" aria-label="볼 영역">
        {usable.map((a) => (
          <button key={a.key} type="button" role="radio" aria-checked={a.key === cur.key} data-on={a.key === cur.key ? "" : undefined} onClick={() => setKey(a.key)} className="hchart__chip">
            {a.label}
          </button>
        ))}
      </div>
      <Bars title="천간" items={cur.stems} />
      <Bars title="지지" items={cur.branches} />
      <Bars title="오행" items={cur.elements} element />
    </div>
  );
}
