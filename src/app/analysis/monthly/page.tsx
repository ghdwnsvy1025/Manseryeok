"use client";

import AnalysisGate from "@/components/analysis/AnalysisGate";
import AnalysisPeriodClient from "@/components/analysis/AnalysisPeriodClient";

export default function AnalysisMonthlyPage() {
  return (
    <AnalysisGate>
      <AnalysisPeriodClient periodType="monthly" />
    </AnalysisGate>
  );
}
