/**
 * Check-in v2 → 기존 category_scores / JournalSaveInput 브리지
 */
import type { JournalScoreSaveRow } from "@/lib/journal/storage";
import {
  CORE_STATE_CODES,
  ordinalToJournalScore,
  type CoreStateCode,
  type DomainCode,
  type OrdinalScore,
} from "./catalog";
import type { CoreStateUi, DomainStateUi } from "./validation";

function rowFromOrdinal(opts: {
  categoryCode: string;
  ordinal: OrdinalScore | null;
  isNotApplicable: boolean;
}): JournalScoreSaveRow {
  if (opts.isNotApplicable) {
    return {
      categoryCode: opts.categoryCode,
      userScore: null,
      rawScore: null,
      isNotApplicable: true,
    };
  }
  const score = opts.ordinal != null ? ordinalToJournalScore(opts.ordinal) : null;
  return {
    categoryCode: opts.categoryCode,
    userScore: score,
    rawScore: score,
    isNotApplicable: false,
  };
}

export function buildCheckInScoreRows(opts: {
  core: Record<CoreStateCode, CoreStateUi>;
  domains: DomainStateUi[];
}): JournalScoreSaveRow[] {
  const rows: JournalScoreSaveRow[] = [];
  for (const code of CORE_STATE_CODES) {
    const s = opts.core[code];
    rows.push(
      rowFromOrdinal({
        categoryCode: code,
        ordinal: s?.ordinal ?? null,
        isNotApplicable: Boolean(s?.isNotApplicable),
      })
    );
  }
  for (const d of opts.domains) {
    rows.push(
      rowFromOrdinal({
        categoryCode: d.code,
        ordinal: d.ordinal,
        isNotApplicable: d.isNotApplicable,
      })
    );
  }
  return rows;
}

export function buildCoreStatesPayload(
  core: Record<CoreStateCode, CoreStateUi>
): Record<string, { ordinal: number | null; isNotApplicable: boolean }> {
  const out: Record<string, { ordinal: number | null; isNotApplicable: boolean }> =
    {};
  for (const code of CORE_STATE_CODES) {
    const s = core[code];
    out[code] = {
      ordinal: s?.isNotApplicable ? null : s?.ordinal ?? null,
      isNotApplicable: Boolean(s?.isNotApplicable),
    };
  }
  return out;
}

export function buildDomainScoresPayload(domains: DomainStateUi[]): Array<{
  code: DomainCode;
  ordinal: number | null;
  isNotApplicable: boolean;
}> {
  return domains.map((d) => ({
    code: d.code,
    ordinal: d.isNotApplicable ? null : d.ordinal,
    isNotApplicable: d.isNotApplicable,
  }));
}
