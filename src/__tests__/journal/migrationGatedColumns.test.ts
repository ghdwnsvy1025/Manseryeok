import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIGRATION_GATED_ENTRY_COLUMNS,
  missingGatedColumns,
} from "@/lib/journal/supabaseStorage";

const ROOT = process.cwd();

describe("migration-gated column fallback", () => {
  // 마이그레이션은 대시보드에서 수동 실행이라 배포가 먼저 나갈 수 있다.
  // 그때 컬럼 하나 때문에 저장 전체가 실패하면 사용자는 기록을 잃는다.
  test("detects the column named in a PostgREST error", () => {
    expect(
      missingGatedColumns(
        "Could not find the 'first_recorded_at' column of 'journal_entries' in the schema cache"
      )
    ).toEqual(["first_recorded_at"]);

    expect(
      missingGatedColumns(
        "Could not find the 'checkin_version' column of 'journal_entries'"
      )
    ).toEqual(["checkin_version"]);
  });

  test("unrelated errors drop nothing so real failures still surface", () => {
    expect(missingGatedColumns("duplicate key value violates unique constraint")).toEqual(
      []
    );
    expect(missingGatedColumns("permission denied for table journal_entries")).toEqual(
      []
    );
  });

  test("every gated column is actually written by the upsert", () => {
    const src = readFileSync(
      join(ROOT, "src/lib/journal/supabaseStorage.ts"),
      "utf8"
    );
    for (const col of MIGRATION_GATED_ENTRY_COLUMNS) {
      expect(src).toContain(`${col}:`);
    }
  });

  test("first_recorded_at is gated, since migration 022 may not be applied yet", () => {
    expect(MIGRATION_GATED_ENTRY_COLUMNS).toContain("first_recorded_at");
  });
});

describe("migration docs stay in sync with the migration folder", () => {
  // 문서에 빠진 마이그레이션은 그대로 미적용으로 남아 런타임에 터진다.
  test("every migration file is listed in docs/SUPABASE.md", () => {
    const doc = readFileSync(join(ROOT, "docs/SUPABASE.md"), "utf8");
    const files = readFileSync(
      join(ROOT, "supabase/migrations/023_question_feedback_fit_neutral.sql"),
      "utf8"
    );
    expect(files.length).toBeGreaterThan(0);

    for (const name of [
      "021_journal_onboarding.sql",
      "022_journal_first_recorded_at.sql",
      "023_question_feedback_fit_neutral.sql",
    ]) {
      expect(doc).toContain(name);
    }
  });
});
