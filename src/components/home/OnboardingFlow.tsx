"use client";

import { useState } from "react";
import Link from "next/link";
import { completeOnboarding } from "@/lib/app/experienceMode";
import type { ExperienceMode } from "@/lib/diary/types";

type Props = {
  onCompleted: () => void;
};

const STEPS = ["value", "example", "mode", "saju"] as const;

export default function OnboardingFlow({ onCompleted }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<ExperienceMode>("balanced");
  const [saving, setSaving] = useState(false);
  const step = STEPS[stepIndex];

  const finish = async () => {
    setSaving(true);
    try {
      await completeOnboarding(mode);
      onCompleted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
        시작하기 {stepIndex + 1}/{STEPS.length}
      </p>

      {step === "value" && (
        <div className="p-4 border-2 space-y-3" style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}>
          <h1 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
            오늘을 기록하면 나만의 하루 패턴이 만들어져요.
          </h1>
          <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
            사주와 매일의 감정을 함께 기록하고, 나에게 반복되는 하루의 흐름을 확인해보세요.
          </p>
          <button type="button" className="ui-primary-btn w-full py-3" onClick={() => setStepIndex(1)}>
            다음
          </button>
        </div>
      )}

      {step === "example" && (
        <div className="p-4 border-2 space-y-3" style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}>
          <h2 className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            기록 후 확인할 수 있는 결과 예시
          </h2>
          <ul className="text-xs space-y-2" style={{ color: "var(--px-text)" }}>
            <li>· 최근 7일 행복도 변화</li>
            <li>· 같은 일진에 내가 남긴 과거 기분</li>
            <li>· 평일과 주말의 컨디션 차이</li>
          </ul>
          <p className="ui-hint">기록이 쌓이기 전에는 빈 통계를 보여주지 않아요.</p>
          <button type="button" className="ui-primary-btn w-full py-3" onClick={() => setStepIndex(2)}>
            다음
          </button>
        </div>
      )}

      {step === "mode" && (
        <div className="p-4 border-2 space-y-3" style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}>
          <h2 className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            표현 방식 선택
          </h2>
          <p className="ui-hint">나중에 설정에서 언제든 바꿀 수 있어요.</p>
          <button
            type="button"
            className="w-full p-3 border-2 text-left"
            style={{
              borderColor: mode === "balanced" ? "var(--px-accent)" : "var(--px-border)",
              background: "var(--px-bg3)",
            }}
            onClick={() => setMode("balanced")}
          >
            <p className="font-black text-sm">균형형</p>
            <p className="ui-hint mt-1">기록과 사주 흐름을 함께 보여줘요.</p>
          </button>
          <button
            type="button"
            className="w-full p-3 border-2 text-left"
            style={{
              borderColor: mode === "saju" ? "var(--px-accent)" : "var(--px-border)",
              background: "var(--px-bg3)",
            }}
            onClick={() => setMode("saju")}
          >
            <p className="font-black text-sm">사주 중심</p>
            <p className="ui-hint mt-1">간지·십신 등 사주 정보를 중심에 둡니다.</p>
          </button>
          <button type="button" className="ui-primary-btn w-full py-3" onClick={() => setStepIndex(3)}>
            다음
          </button>
        </div>
      )}

      {step === "saju" && (
        <div className="p-4 border-2 space-y-3" style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}>
          <h2 className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            내 사주 등록하고 시작하기
          </h2>
          <p className="text-xs" style={{ color: "var(--px-text)" }}>
            사주는 기록을 해석하기 위한 기본 정보예요. 등록 후 오늘의 기본 흐름을 확인하고 첫 기록을 남길 수 있어요.
          </p>
          <button
            type="button"
            className="ui-primary-btn w-full py-3"
            disabled={saving}
            onClick={async () => {
              await finish();
              window.location.href = "/saju";
            }}
          >
            {saving ? "저장 중..." : "내 사주 등록하고 시작하기"}
          </button>
          <button
            type="button"
            className="w-full py-2 text-xs font-bold border"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            disabled={saving}
            onClick={async () => {
              await finish();
            }}
          >
            나중에 등록하고 홈으로
          </button>
          <Link href="/diary" className="block text-center text-xs underline" style={{ color: "var(--px-text2)" }}>
            바로 일기만 쓰기
          </Link>
        </div>
      )}
    </div>
  );
}
