import { describe, expect, test } from "@jest/globals";
import {
  DIARY_BACKFILL_VERSION,
  defaultBackfillOptions,
  emptyProgress,
  planEntryActions,
  planBatch,
  encodeCursor,
  decodeCursor,
  applyActionToProgress,
  isInScope,
  type BackfillEntryRef,
} from "@/lib/journal/backfill/diaryFeatures";

const base = (over: Partial<BackfillEntryRef> = {}): BackfillEntryRef => ({
  id: "e1",
  userId: "u1",
  entryDate: "2026-01-15",
  hasMatchingSnapshot: false,
  createdAt: "2026-01-15T10:00:00Z",
  firstRecordedAt: null,
  ...over,
});

describe("diary feature backfill planner", () => {
  test("version is pinned", () => {
    expect(DIARY_BACKFILL_VERSION).toMatch(/^diary-features-v/);
  });

  test("default is dry-run", () => {
    expect(defaultBackfillOptions().dryRun).toBe(true);
  });

  test("skips same-version snapshots (idempotency)", () => {
    const actions = planEntryActions(
      base({ hasMatchingSnapshot: true }),
      defaultBackfillOptions()
    );
    expect(actions).toEqual([{ type: "skip", reason: "same_version" }]);
  });

  test("skips deleted users", () => {
    const actions = planEntryActions(
      base({ userDeleted: true }),
      defaultBackfillOptions()
    );
    expect(actions).toEqual([{ type: "skip", reason: "user_deleted" }]);
  });

  test("plans first_recorded_at + snapshot for new entries", () => {
    const actions = planEntryActions(base(), defaultBackfillOptions());
    expect(actions).toEqual([
      {
        type: "ensure_first_recorded_at",
        value: "2026-01-15T10:00:00Z",
      },
      { type: "create_snapshot" },
    ]);
  });

  test("does not rewrite first_recorded_at when already set", () => {
    const actions = planEntryActions(
      base({ firstRecordedAt: "2026-01-15T09:00:00Z" }),
      defaultBackfillOptions()
    );
    expect(actions).toEqual([{ type: "create_snapshot" }]);
  });

  test("date and user scope filters", () => {
    const opts = defaultBackfillOptions({
      userId: "u1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    });
    expect(isInScope(base(), opts)).toBe(true);
    expect(isInScope(base({ userId: "u2" }), opts)).toBe(false);
    expect(isInScope(base({ entryDate: "2025-12-31" }), opts)).toBe(false);
  });

  test("cursor resume skips already-processed rows", () => {
    const entries = [
      base({ id: "a", entryDate: "2026-01-01" }),
      base({ id: "b", entryDate: "2026-01-02" }),
      base({ id: "c", entryDate: "2026-01-03" }),
    ];
    const { plans, nextCursor } = planBatch(
      entries,
      defaultBackfillOptions({
        cursor: encodeCursor("2026-01-01", "a"),
        batchSize: 10,
      })
    );
    expect(plans.map((p) => p.entryId)).toEqual(["b", "c"]);
    expect(decodeCursor(nextCursor)).toEqual({
      entryDate: "2026-01-03",
      id: "c",
    });
  });

  test("batch size caps the plan", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      base({
        id: `e${i}`,
        entryDate: `2026-01-${String(i + 1).padStart(2, "0")}`,
      })
    );
    const { plans } = planBatch(
      entries,
      defaultBackfillOptions({ batchSize: 5 })
    );
    expect(plans).toHaveLength(5);
  });

  test("progress accounting", () => {
    const p = emptyProgress(defaultBackfillOptions());
    applyActionToProgress(p, { type: "skip", reason: "same_version" }, false);
    applyActionToProgress(p, { type: "create_snapshot" }, true);
    applyActionToProgress(
      p,
      { type: "ensure_first_recorded_at", value: "x" },
      true
    );
    expect(p.skippedSameVersion).toBe(1);
    expect(p.snapshotsCreated).toBe(1);
    expect(p.ensuredFirstRecordedAt).toBe(1);
  });

  test("plans never carry content fields", () => {
    const { plans } = planBatch([base()], defaultBackfillOptions());
    const json = JSON.stringify(plans);
    expect(json).not.toMatch(/content/i);
    expect(json).not.toMatch(/일기/);
  });
});
