"use client";

import type {
  ActivityLevel,
  SleepSatisfaction,
  SocialMet,
  WorkIntensity,
} from "@/lib/diary/types";

type Props = {
  sleepSatisfaction: SleepSatisfaction | null;
  activityLevel: ActivityLevel | null;
  socialMet: SocialMet | null;
  workIntensity: WorkIntensity | null;
  onChange: (next: {
    sleepSatisfaction: SleepSatisfaction | null;
    activityLevel: ActivityLevel | null;
    socialMet: SocialMet | null;
    workIntensity: WorkIntensity | null;
  }) => void;
  disabled?: boolean;
};

function ChipRow<T extends string>({
  label,
  value,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  value: T | null;
  options: Array<{ id: T; label: string }>;
  onSelect: (id: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
        {label} (선택)
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(selected ? null : opt.id)}
              className="px-2 py-1 text-[11px] font-bold border"
              style={{
                borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
                color: selected ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LifestyleOptionalInputs({
  sleepSatisfaction,
  activityLevel,
  socialMet,
  workIntensity,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-2 p-2 border" style={{ borderColor: "var(--px-border)" }}>
      <p className="ui-section-title">생활 기록 (선택)</p>
      <p className="ui-hint">의료적 건강 예측이 아니라, 내가 느낀 컨디션을 남기는 항목이에요.</p>
      <ChipRow
        label="수면 만족도"
        value={sleepSatisfaction}
        disabled={disabled}
        options={[
          { id: "poor", label: "부족" },
          { id: "fair", label: "보통" },
          { id: "good", label: "좋음" },
          { id: "great", label: "아주 좋음" },
        ]}
        onSelect={(v) =>
          onChange({ sleepSatisfaction: v, activityLevel, socialMet, workIntensity })
        }
      />
      <ChipRow
        label="활동량"
        value={activityLevel}
        disabled={disabled}
        options={[
          { id: "low", label: "낮음" },
          { id: "moderate", label: "보통" },
          { id: "high", label: "높음" },
        ]}
        onSelect={(v) =>
          onChange({ sleepSatisfaction, activityLevel: v, socialMet, workIntensity })
        }
      />
      <ChipRow
        label="사람을 만났는지"
        value={socialMet}
        disabled={disabled}
        options={[
          { id: "alone", label: "혼자" },
          { id: "few", label: "조금" },
          { id: "many", label: "많이" },
        ]}
        onSelect={(v) =>
          onChange({ sleepSatisfaction, activityLevel, socialMet: v, workIntensity })
        }
      />
      <ChipRow
        label="업무/공부 강도"
        value={workIntensity}
        disabled={disabled}
        options={[
          { id: "light", label: "가벼움" },
          { id: "normal", label: "보통" },
          { id: "heavy", label: "높음" },
        ]}
        onSelect={(v) =>
          onChange({ sleepSatisfaction, activityLevel, socialMet, workIntensity: v })
        }
      />
    </div>
  );
}
