import { describe, expect, test } from "@jest/globals";
import {
  planLocalJournalImport,
  resolveJournalConflicts,
  journalEntryToSaveInput,
} from "@/lib/journal/mergeLocalJournalImport";
import type { JournalEntry } from "@/lib/journal/types";

function entry(
  date: string,
  content: string,
  updatedAt: string,
  happiness = 5
): JournalEntry {
  return {
    id: `id-${date}`,
    userId: null,
    sajuProfileId: "local",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content,
    overallSatisfaction: happiness as 5,
    happinessScore: happiness,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores: [],
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: 2,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("planLocalJournalImport", () => {
  test("uploads dates missing on remote", () => {
    const local = [entry("2026-07-01", "a", "t1")];
    const plan = planLocalJournalImport(local, []);
    expect(plan.toUpload).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("flags conflicting dates", () => {
    const local = [entry("2026-07-01", "local", "t2")];
    const remote = [entry("2026-07-01", "remote", "t1")];
    const plan = planLocalJournalImport(local, remote);
    expect(plan.toUpload).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
  });

  test("skips identical rows", () => {
    const shared = entry("2026-07-01", "same", "t1");
    const plan = planLocalJournalImport([shared], [{ ...shared }]);
    expect(plan.toUpload).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("resolve prefers local when chosen", () => {
    const local = entry("2026-07-01", "local", "t2");
    const remote = entry("2026-07-01", "remote", "t1");
    const resolved = resolveJournalConflicts(
      [{ date: "2026-07-01", local, remote }],
      { "2026-07-01": "local" }
    );
    expect(resolved[0]?.content).toBe("local");
  });

  test("toSaveInput maps profile id", () => {
    const input = journalEntryToSaveInput(
      entry("2026-07-01", "hi", "t1"),
      "profile-1"
    );
    expect(input.sajuProfileId).toBe("profile-1");
    expect(input.entryDate).toBe("2026-07-01");
    expect(input.content).toBe("hi");
  });
});
