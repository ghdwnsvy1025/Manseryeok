/**
 * 일기 저장 직후 홈 이동 → 다시 수정 진입 시
 * list/getByDate 레이스여도 폼을 복원하기 위한 스냅샷.
 * sessionStorage + localStorage 이중 저장.
 */
import type { HappinessScore } from "@/lib/journal/happinessScale";
import type { JournalEntry } from "@/lib/journal/types";
import {
  CORE_STATE_CODES,
  adaptLegacyCoreStates,
  journalScoreToOrdinal,
  type CoreStateCode,
  type DomainCode,
  type OrdinalScore,
} from "@/lib/journal/checkin/catalog";

export const LAST_SAVED_CHECKIN_KEY = "manseryeok:last-saved-checkin:v2";

export type SavedCheckInForm = {
  entryDate: string;
  entryId: string;
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
};

export type LastSavedCheckIn = {
  entry: JournalEntry;
  form: SavedCheckInForm;
  at: number;
};

function writeBoth(raw: string): void {
  try {
    window.sessionStorage.setItem(LAST_SAVED_CHECKIN_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LAST_SAVED_CHECKIN_KEY, raw);
  } catch {
    /* ignore */
  }
}

function readRaw(): string | null {
  try {
    const s = window.sessionStorage.getItem(LAST_SAVED_CHECKIN_KEY);
    if (s) return s;
  } catch {
    /* ignore */
  }
  try {
    return window.localStorage.getItem(LAST_SAVED_CHECKIN_KEY);
  } catch {
    return null;
  }
}

/** 저장 직후 스냅샷이 '필수 입력까지' 갖췄는지 — 불완전하면 entry 로드를 우선 */
export function isSavedFormComplete(form: SavedCheckInForm | null | undefined): boolean {
  if (!form || form.happiness == null) return false;
  return CORE_STATE_CODES.every((code) => {
    const row = form.core[code];
    return row != null && row.ordinal != null && !row.isNotApplicable;
  });
}

function coreFromEntry(
  entry: JournalEntry
): SavedCheckInForm["core"] {
  const core: SavedCheckInForm["core"] = {};
  if (entry.coreStates) {
    const adapted = adaptLegacyCoreStates(entry.coreStates);
    for (const code of CORE_STATE_CODES) {
      const row = adapted[code];
      core[code] = {
        ordinal:
          row.isNotApplicable || row.ordinal == null
            ? null
            : (row.ordinal as OrdinalScore),
        isNotApplicable: false,
      };
    }
    return core;
  }
  for (const s of entry.scores ?? []) {
    if (!(CORE_STATE_CODES as readonly string[]).includes(s.categoryCode)) {
      continue;
    }
    const code = s.categoryCode as CoreStateCode;
    const score = s.isNotApplicable
      ? null
      : (s.userScore ?? s.finalScore ?? null);
    core[code] = {
      ordinal: score != null ? journalScoreToOrdinal(score) : null,
      isNotApplicable: false,
    };
  }
  return core;
}

export function formFromEntry(entry: JournalEntry): SavedCheckInForm {
  return {
    entryDate: entry.entryDate,
    entryId: entry.id,
    content: entry.content ?? "",
    mainEvent: entry.mainEventText ?? "",
    happiness:
      (entry.happinessScore as HappinessScore | null) ??
      (entry.overallSatisfaction as HappinessScore | null) ??
      null,
    moods:
      entry.moodLabels?.length > 0
        ? [...entry.moodLabels]
        : entry.moodLabel
          ? [entry.moodLabel]
          : [],
    tagCodes: (entry.tags ?? []).map((t) => t.tagCode),
    core: coreFromEntry(entry),
    domains: (entry.domainScores ?? []).map((d) => ({
      code: d.code as DomainCode,
      ordinal: (d.ordinal as OrdinalScore | null) ?? null,
      isNotApplicable: Boolean(d.isNotApplicable),
    })),
  };
}

export function buildSavedCheckInForm(input: {
  entry: JournalEntry;
  content: string;
  mainEvent: string;
  happiness: HappinessScore | null;
  moods: string[];
  tagCodes: string[];
  core: SavedCheckInForm["core"];
  domains: SavedCheckInForm["domains"];
}): SavedCheckInForm {
  return {
    entryDate: input.entry.entryDate,
    entryId: input.entry.id,
    content: input.content,
    mainEvent: input.mainEvent,
    happiness: input.happiness,
    moods: [...input.moods],
    tagCodes: [...input.tagCodes],
    core: { ...input.core },
    domains: input.domains.map((d) => ({ ...d })),
  };
}

export function setLastSavedCheckIn(
  entry: JournalEntry,
  form?: SavedCheckInForm
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: LastSavedCheckIn = {
      entry,
      form: form ?? formFromEntry(entry),
      at: Date.now(),
    };
    writeBoth(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function parsePayload(
  raw: string,
  entryDate: string,
  maxAgeMs: number
): LastSavedCheckIn | null {
  const parsed = JSON.parse(raw) as LastSavedCheckIn;
  if (!parsed?.entry?.entryDate || typeof parsed.at !== "number") return null;
  if (Date.now() - parsed.at > maxAgeMs) return null;
  if (parsed.entry.entryDate !== entryDate) return null;
  if (!parsed.form || !isSavedFormComplete(parsed.form)) {
    // 불완전·구버전 스냅샷은 entry에서 폼을 재구성
    parsed.form = formFromEntry(parsed.entry);
  }
  return parsed;
}

/** entry + form 스냅샷. 최대 24시간 */
export function peekLastSavedCheckIn(
  entryDate: string,
  maxAgeMs = 24 * 60 * 60_000
): LastSavedCheckIn | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readRaw();
    if (!raw) return null;
    const parsed = parsePayload(raw, entryDate, maxAgeMs);
    if (!parsed) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function peekLastSavedEntry(entryDate: string): JournalEntry | null {
  return peekLastSavedCheckIn(entryDate)?.entry ?? null;
}

export function peekLastSavedForm(entryDate: string): SavedCheckInForm | null {
  const snap = peekLastSavedCheckIn(entryDate);
  if (!snap) return null;
  if (isSavedFormComplete(snap.form)) return snap.form;
  // entry 기반 재구성 폼이라도 필수가 채워져 있으면 사용
  const rebuilt = formFromEntry(snap.entry);
  return isSavedFormComplete(rebuilt) ? rebuilt : snap.form;
}
