"use client";

import type { HappinessRating } from "@/lib/diary/happiness";
import { HAPPINESS_RATING_LABELS } from "@/lib/diary/happiness";
import RatingPicker from "@/components/diary/RatingPicker";

type Props = {
  value: HappinessRating;
  onChange: (value: HappinessRating) => void;
  disabled?: boolean;
};

export default function HappinessRatingPicker({ value, onChange, disabled }: Props) {
  return (
    <RatingPicker
      title="행복도"
      value={value}
      onChange={onChange}
      labels={HAPPINESS_RATING_LABELS}
      disabled={disabled}
    />
  );
}
