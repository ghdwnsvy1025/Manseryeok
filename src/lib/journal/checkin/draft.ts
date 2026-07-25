import type { HappinessScore } from "@/lib/journal/happinessScale";
import type { CoreStateCode, DomainCode, OrdinalScore } from "./catalog";

export type CheckInDraft = {
  entryDate: string;
  content: string;
  mainEvent: string;
  happiness: HappinessScore | null;
  moods: string[];
  tagCodes: string[];
  core: Partial<
    Record<CoreStateCode, { ordinal: OrdinalScore | null; isNotApplicable: boolean }>
  >;
  domains: Array<{
    code: DomainCode;
    ordinal: OrdinalScore | null;
    isNotApplicable: boolean;
  }>;
  updatedAt: string;
};

function draftKey(entryDate: string): string {
  return `manseryeok:checkin-draft:v1:${entryDate}`;
}

export function loadCheckInDraft(entryDate: string): CheckInDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(entryDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckInDraft;
    if (parsed?.entryDate !== entryDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckInDraft(draft: CheckInDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      draftKey(draft.entryDate),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCheckInDraft(entryDate: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(entryDate));
  } catch {
    /* ignore */
  }
}
