"use client";

import EvidenceDisclosure from "@/components/forecast/EvidenceDisclosure";
import type { ForecastEvidence } from "@/lib/forecast/types";

type Props = {
  traditional: ForecastEvidence[];
  observed: ForecastEvidence[];
  recent: ForecastEvidence[];
  caution: ForecastEvidence[];
  title?: string;
};

/** Product shell wrapper around existing forecast evidence UI. */
export default function ForecastEvidenceDrawer({
  traditional,
  observed,
  recent,
  caution,
  title = "근거 보기",
}: Props) {
  return (
    <details className="border-2" style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}>
      <summary
        className="px-3 py-2 text-xs font-bold cursor-pointer"
        style={{ color: "var(--px-accent)" }}
      >
        {title}
      </summary>
      <div className="px-3 pb-3">
        <EvidenceDisclosure
          traditional={traditional}
          observed={observed}
          recent={recent}
          caution={caution}
        />
      </div>
    </details>
  );
}
