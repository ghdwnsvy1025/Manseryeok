"use client";

import OnboardingFlow from "@/components/home/OnboardingFlow";
import HomeDashboard from "@/components/home/HomeDashboard";
import { useUserAppState } from "@/hooks/useUserAppState";

export default function HomePage() {
  const { state, loading, error, refresh } = useUserAppState();

  if (loading) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  if (error) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-sm font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
        <button type="button" className="ui-primary-btn px-3 py-2 text-xs" onClick={() => void refresh()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!state || state.kind === "new_user") {
    return <OnboardingFlow onCompleted={() => void refresh()} />;
  }

  return <HomeDashboard state={state} onModeChanged={() => void refresh()} />;
}
