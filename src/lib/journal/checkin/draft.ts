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

/** 사용자가 아직 아무 것도 고르지 않은 빈 초안인지 */
export function isCheckInDraftEmpty(draft: CheckInDraft): boolean {
  const coreEmpty = Object.values(draft.core ?? {}).every(
    (c) => !c || (c.ordinal == null && !c.isNotApplicable)
  );
  const domainsEmpty = (draft.domains ?? []).every(
    (d) => d.ordinal == null && !d.isNotApplicable
  );
  return (
    !draft.content?.trim() &&
    !draft.mainEvent?.trim() &&
    draft.happiness == null &&
    (draft.moods?.length ?? 0) === 0 &&
    (draft.tagCodes?.length ?? 0) === 0 &&
    coreEmpty &&
    domainsEmpty
  );
}

export function loadCheckInDraft(entryDate: string): CheckInDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(entryDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckInDraft;
    if (parsed?.entryDate !== entryDate) return null;
    if (isCheckInDraftEmpty(parsed)) {
      window.localStorage.removeItem(draftKey(entryDate));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckInDraft(draft: CheckInDraft): void {
  if (typeof window === "undefined") return;
  try {
    if (isCheckInDraftEmpty(draft)) {
      window.localStorage.removeItem(draftKey(draft.entryDate));
      return;
    }
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

export function clearCheckInDrafts(entryDates: Iterable<string>): void {
  for (const date of entryDates) {
    clearCheckInDraft(date);
  }
}
