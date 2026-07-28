import {
  DEFAULT_RECOMMENDED_CODES,
} from "./categoryCatalog";
import type { CategoryCode, UserCategoryPreference } from "./types";
import { validateEnabledCategorySelection } from "./validation";

const PREFS_KEY_V1 = "manseryeok_journal_category_prefs_v1";
const PREFS_KEY_PREFIX_V2 = "manseryeok_journal_category_prefs_v2:";

function prefsKey(sajuProfileId: string | null | undefined): string {
  if (sajuProfileId) return `${PREFS_KEY_PREFIX_V2}${sajuProfileId}`;
  return PREFS_KEY_V1;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultPreferences(
  userId: string | null = null,
  sajuProfileId: string | null = null
): UserCategoryPreference[] {
  const at = nowIso();
  return DEFAULT_RECOMMENDED_CODES.map((code, index) => ({
    userId,
    sajuProfileId,
    categoryCode: code,
    enabled: true,
    sortOrder: index,
    enabledAt: at,
    disabledAt: null,
    updatedAt: at,
  }));
}

export function loadCategoryPreferencesLocal(
  userId: string | null = null,
  sajuProfileId: string | null = null
): UserCategoryPreference[] {
  if (typeof window === "undefined") {
    return createDefaultPreferences(userId, sajuProfileId);
  }
  try {
    const key = prefsKey(sajuProfileId);
    let raw = localStorage.getItem(key);
    // Migrate legacy account-scoped prefs into this profile once
    if (!raw && sajuProfileId) {
      const legacy = localStorage.getItem(PREFS_KEY_V1);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return createDefaultPreferences(userId, sajuProfileId);
    const parsed = JSON.parse(raw) as UserCategoryPreference[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createDefaultPreferences(userId, sajuProfileId);
    }
    return parsed.map((p) => ({
      ...p,
      userId: userId ?? p.userId,
      sajuProfileId: sajuProfileId ?? p.sajuProfileId ?? null,
    }));
  } catch {
    return createDefaultPreferences(userId, sajuProfileId);
  }
}

export function saveCategoryPreferencesLocal(
  prefs: UserCategoryPreference[],
  sajuProfileId?: string | null
): { ok: boolean; error?: string } {
  const enabled = prefs
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => p.categoryCode);
  const check = validateEnabledCategorySelection(enabled);
  if (!check.ok) return check;

  if (typeof window !== "undefined") {
    const profileId =
      sajuProfileId ?? prefs.find((p) => p.sajuProfileId)?.sajuProfileId ?? null;
    localStorage.setItem(prefsKey(profileId), JSON.stringify(prefs));
  }
  return { ok: true };
}

export function buildPreferencesFromSelection(
  enabledOrdered: CategoryCode[],
  previous: UserCategoryPreference[] | null,
  userId: string | null = null,
  sajuProfileId: string | null = null
): UserCategoryPreference[] {
  const check = validateEnabledCategorySelection(enabledOrdered);
  if (!check.ok) {
    throw new Error(check.error);
  }
  const at = nowIso();
  const prevMap = new Map((previous ?? []).map((p) => [p.categoryCode, p]));
  const allCodes = new Set([
    ...enabledOrdered,
    ...Array.from(prevMap.keys()),
  ]);

  const result: UserCategoryPreference[] = [];
  let order = 0;
  for (const code of enabledOrdered) {
    const prev = prevMap.get(code);
    result.push({
      userId,
      sajuProfileId,
      categoryCode: code,
      enabled: true,
      sortOrder: order++,
      enabledAt: prev?.enabled ? prev.enabledAt : at,
      disabledAt: null,
      updatedAt: at,
    });
  }
  for (const code of allCodes) {
    if (enabledOrdered.includes(code)) continue;
    const prev = prevMap.get(code);
    result.push({
      userId,
      sajuProfileId,
      categoryCode: code,
      enabled: false,
      sortOrder: order++,
      enabledAt: prev?.enabledAt ?? null,
      disabledAt: at,
      updatedAt: at,
    });
  }
  return result;
}

export function getEnabledCodesOrdered(
  prefs: UserCategoryPreference[]
): CategoryCode[] {
  return prefs
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => p.categoryCode);
}
