import {
  DEFAULT_RECOMMENDED_CODES,
} from "./categoryCatalog";
import type { CategoryCode, UserCategoryPreference } from "./types";
import { validateEnabledCategorySelection } from "./validation";

const PREFS_KEY = "manseryeok_journal_category_prefs_v1";

function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultPreferences(
  userId: string | null = null
): UserCategoryPreference[] {
  const at = nowIso();
  return DEFAULT_RECOMMENDED_CODES.map((code, index) => ({
    userId,
    categoryCode: code,
    enabled: true,
    sortOrder: index,
    enabledAt: at,
    disabledAt: null,
    updatedAt: at,
  }));
}

export function loadCategoryPreferencesLocal(
  userId: string | null = null
): UserCategoryPreference[] {
  if (typeof window === "undefined") {
    return createDefaultPreferences(userId);
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return createDefaultPreferences(userId);
    const parsed = JSON.parse(raw) as UserCategoryPreference[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createDefaultPreferences(userId);
    }
    return parsed.map((p) => ({ ...p, userId: userId ?? p.userId }));
  } catch {
    return createDefaultPreferences(userId);
  }
}

export function saveCategoryPreferencesLocal(
  prefs: UserCategoryPreference[]
): { ok: boolean; error?: string } {
  const enabled = prefs
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => p.categoryCode);
  const check = validateEnabledCategorySelection(enabled);
  if (!check.ok) return check;

  if (typeof window !== "undefined") {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }
  return { ok: true };
}

export function buildPreferencesFromSelection(
  enabledOrdered: CategoryCode[],
  previous: UserCategoryPreference[] | null,
  userId: string | null = null
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
      categoryCode: code,
      enabled: true,
      sortOrder: order++,
      enabledAt: prev?.enabled ? prev.enabledAt : at,
      disabledAt: null,
      updatedAt: at,
    });
    allCodes.delete(code);
  }
  for (const code of Array.from(allCodes)) {
    const prev = prevMap.get(code as CategoryCode);
    if (!prev) continue;
    result.push({
      ...prev,
      userId,
      enabled: false,
      disabledAt: prev.disabledAt ?? at,
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
