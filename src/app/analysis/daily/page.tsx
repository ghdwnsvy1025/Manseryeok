"use client";

import AnalysisGate from "@/components/analysis/AnalysisGate";
import AnalysisPeriodClient from "@/components/analysis/AnalysisPeriodClient";

export default function AnalysisDailyPage() {
  return (
    <AnalysisGate>
      <AnalysisPeriodClient periodType="daily" />
    </AnalysisGate>
  );
}
