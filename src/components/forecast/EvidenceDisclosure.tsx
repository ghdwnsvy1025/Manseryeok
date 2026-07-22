"use client";

import type { ForecastEvidence } from "@/lib/forecast/types";

type Props = {
  traditional: ForecastEvidence[];
  observed: ForecastEvidence[];
  recent: ForecastEvidence[];
  caution: ForecastEvidence[];
};

export default function EvidenceDisclosure({
  traditional,
  observed,
  recent,
  caution,
}: Props) {
  return (
    <details className="mt-1">
      <summary
        className="cursor-pointer text-[11px] font-bold"
        style={{ color: "var(--px-text2)" }}
      >
        근거 보기 (기록 · 명리)
      </summary>
      <div className="mt-2 space-y-2 text-[11px]" style={{ color: "var(--px-text2)" }}>
        {traditional.length > 0 && (
          <div>
            <p className="font-black" style={{ color: "var(--px-accent)" }}>
              명리 근거
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {traditional.map((e, i) => (
                <li key={`t-${i}`}>{e.text}</li>
              ))}
            </ul>
          </div>
        )}
        {observed.length > 0 && (
          <div>
            <p className="font-black" style={{ color: "var(--px-accent)" }}>
              내 기록 근거
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {observed.map((e, i) => (
                <li key={`o-${i}`}>{e.text}</li>
              ))}
            </ul>
          </div>
        )}
        {recent.length > 0 && (
          <div>
            <p className="font-black">최근 상태</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {recent.map((e, i) => (
                <li key={`r-${i}`}>{e.text}</li>
              ))}
            </ul>
          </div>
        )}
        {caution.length > 0 && (
          <div>
            <p className="font-black">주의</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {caution.map((e, i) => (
                <li key={`c-${i}`}>{e.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
