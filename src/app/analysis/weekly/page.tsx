"use client";

import AnalysisGate from "@/components/analysis/AnalysisGate";
import AnalysisPeriodClient from "@/components/analysis/AnalysisPeriodClient";

export default function AnalysisWeeklyPage() {
  return (
    <AnalysisGate>
      <AnalysisPeriodClient periodType="weekly" />
    </AnalysisGate>
  );
}
