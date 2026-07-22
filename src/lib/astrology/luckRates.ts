/**
 * 자료 B §13–14 LUCK_BASE_WEIGHTS 반영률.
 * source: docs/sajubase_final.md (B-13 / B-14)
 */
import type { LuckKey, LuckMixRates } from "./types";

/** B-13 / B-14 */
export const LUCK_BASE_WEIGHTS: Record<LuckKey, number> = {
  daewoon: 50,
  yearly: 25,
  monthly: 12,
  daily: 6,
};

export const NATIVE_LUCK_CAP = 60;

export const LUCK_ONLY_SELF_RATE = 0.55;
export const LUCK_ONLY_INTERACTION_RATE = 0.45;

const LUCK_ORDER: LuckKey[] = ["daewoon", "yearly", "monthly", "daily"];

export function selectedLuckKeys(input: {
  daewoon?: unknown;
  yearly?: unknown;
  monthly?: unknown;
  daily?: unknown;
}): LuckKey[] {
  return LUCK_ORDER.filter((k) => Boolean(input[k]));
}

/**
 * native_with_luck 최종 반영률 (0–1).
 * activeLuckRate = min(sum(base), 60); original = 100 - active.
 */
export function resolveNativeWithLuckRates(
  selected: LuckKey[]
): LuckMixRates {
  const empty: LuckMixRates = {
    original: 1,
    daewoon: 0,
    yearly: 0,
    monthly: 0,
    daily: 0,
    activeLuckRate: 0,
    selected: [],
    sourceRuleId: "B-13-native-with-luck",
  };
  if (selected.length === 0) return empty;

  const sumBase = selected.reduce((s, k) => s + LUCK_BASE_WEIGHTS[k], 0);
  const activeLuckRate = Math.min(sumBase, NATIVE_LUCK_CAP);
  const originalPct = 100 - activeLuckRate;
  const rates: LuckMixRates = {
    ...empty,
    original: originalPct / 100,
    activeLuckRate: activeLuckRate / 100,
    selected: [...selected],
  };
  for (const k of selected) {
    rates[k] = (activeLuckRate * LUCK_BASE_WEIGHTS[k]) / sumBase / 100;
  }
  return rates;
}

/** luck_only: 선택 운끼리만 normalize (원국 0) */
export function resolveLuckOnlyRates(selected: LuckKey[]): LuckMixRates {
  const empty: LuckMixRates = {
    original: 0,
    daewoon: 0,
    yearly: 0,
    monthly: 0,
    daily: 0,
    activeLuckRate: 1,
    selected: [],
    sourceRuleId: "B-14-luck-only",
  };
  if (selected.length === 0) {
    return { ...empty, activeLuckRate: 0 };
  }
  const sumBase = selected.reduce((s, k) => s + LUCK_BASE_WEIGHTS[k], 0);
  const rates: LuckMixRates = {
    ...empty,
    selected: [...selected],
  };
  for (const k of selected) {
    rates[k] = LUCK_BASE_WEIGHTS[k] / sumBase;
  }
  return rates;
}
