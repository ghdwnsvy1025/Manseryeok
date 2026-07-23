import { computeFinalScore } from "./finalScore";
import { isCategoryCode } from "./categoryCatalog";
import { isJournalScore, type JournalScore } from "./scoreScale";
import type { JournalScoreSaveRow } from "./storage";
import type { CategoryCode, CategoryScoreRecord } from "./types";

export function resolveUserScore(row: JournalScoreSaveRow): JournalScore | null {
  if (row.isNotApplicable) return null;
  const v = row.userScore !== undefined ? row.userScore : row.rawScore ?? null;
  return isJournalScore(v) ? v : null;
}

export function buildCategoryScoreRecords(opts: {
  entryId: string;
  userId: string | null;
  now: string;
  inputScores: JournalScoreSaveRow[];
  previous: CategoryScoreRecord[];
}): CategoryScoreRecord[] {
  const prevByCode = new Map(opts.previous.map((s) => [s.categoryCode, s]));
  const out: CategoryScoreRecord[] = [];

  for (const row of opts.inputScores) {
    if (!isCategoryCode(row.categoryCode)) continue;

    const userScore = resolveUserScore(row);
    const aiScore =
      row.aiScore != null && Number.isFinite(row.aiScore) ? Number(row.aiScore) : null;
    const finalScore =
      row.finalScore !== undefined
        ? row.finalScore
        : computeFinalScore({
            userScore,
            aiScore,
            isNotApplicable: row.isNotApplicable,
          });

    // 미입력 스킵 (저장 검증에서 이미 거부하지만 방어)
    if (!row.isNotApplicable && userScore == null && aiScore == null) {
      continue;
    }

    const prev = prevByCode.get(row.categoryCode as CategoryCode);
    out.push({
      id: prev?.id ?? cryptoRandomId(),
      entryId: opts.entryId,
      userId: opts.userId,
      categoryCode: row.categoryCode as CategoryCode,
      userScore,
      aiScore,
      finalScore,
      rawScore: userScore,
      isNotApplicable: row.isNotApplicable,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: prev?.createdAt ?? opts.now,
      updatedAt: opts.now,
    });
  }
  return out;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
