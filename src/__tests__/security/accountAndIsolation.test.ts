import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_CASCADE_TABLES,
  ACCOUNT_DELETE_CONFIRM_PHRASE,
  validateAccountDeleteConfirmation,
  summarizeCascadeProbes,
} from "@/lib/account/deleteAccount";
import { requireAdmin, isAdminEmail } from "@/lib/auth/admin";
import { validateExposureInput } from "@/lib/journal/exposure";
import { validateContentFeedbackInput } from "@/lib/journal/contentFeedback";
import { validateQuestionFeedbackInput } from "@/lib/journal/questionFeedback";
import { validateOnboardingAnswers } from "@/lib/journal/onboarding/questions";

const ROOT = process.cwd();

describe("account deletion cascade contract", () => {
  test("confirmation phrase is required", () => {
    expect(validateAccountDeleteConfirmation("yes").ok).toBe(false);
    expect(
      validateAccountDeleteConfirmation(ACCOUNT_DELETE_CONFIRM_PHRASE).ok
    ).toBe(true);
  });

  test("cascade table list covers journal / insight / quote / astrology", () => {
    expect(ACCOUNT_CASCADE_TABLES).toContain("journal_entries");
    expect(ACCOUNT_CASCADE_TABLES).toContain("daily_insight_contexts");
    expect(ACCOUNT_CASCADE_TABLES).toContain("daily_quote_deliveries");
    expect(ACCOUNT_CASCADE_TABLES).toContain("astrology_snapshots");
    expect(ACCOUNT_CASCADE_TABLES).toContain("question_feedback_events");
    expect(ACCOUNT_CASCADE_TABLES).toContain("journal_onboarding_profiles");
    expect(ACCOUNT_CASCADE_TABLES).toContain("beta_feedback");
  });

  test("leftover rows fail the probe summary", () => {
    expect(
      summarizeCascadeProbes([
        { table: "journal_entries", remaining: 0 },
        { table: "daily_fortunes", remaining: 2 },
      ])
    ).toEqual({
      ok: false,
      leftoverTables: ["daily_fortunes"],
    });
  });

  test("delete route uses service-role admin.deleteUser and never logs content", () => {
    const src = readFileSync(
      join(ROOT, "src/app/api/account/delete/route.ts"),
      "utf8"
    );
    expect(src).toContain("auth.admin.deleteUser");
    expect(src).toContain("ACCOUNT_CASCADE_TABLES");
    expect(src).not.toMatch(/\.select\([^\)]*content/);
  });
});

describe("security: input validation rejects abuse payloads", () => {
  test("XSS-like strings are not accepted as event types / ratings", () => {
    expect(
      validateExposureInput({
        eventDate: "2026-07-25",
        contentType: "<script>alert(1)</script>",
        eventType: "question_impression",
      }).ok
    ).toBe(true); // contentType is free text but eventType is enum
    expect(
      validateExposureInput({
        eventDate: "2026-07-25",
        contentType: "daily_question",
        eventType: "<script>" as never,
      }).ok
    ).toBe(false);
    expect(
      validateContentFeedbackInput({
        eventDate: "2026-07-25",
        contentType: "verified_quote",
        rating: "loved<script>" as never,
      }).ok
    ).toBe(false);
    expect(
      validateQuestionFeedbackInput({
        questionDate: "2026-07-25",
        eventType: "fit_good; DROP TABLE" as never,
      }).ok
    ).toBe(false);
  });

  test("onboarding rejects unknown question ids / over-select", () => {
    const bad = validateOnboardingAnswers({
      focus_areas: ["a", "b", "c", "d", "e"],
    } as never);
    expect(bad.ok).toBe(false);
  });

  test("admin helper fail-closes when ADMIN_EMAILS empty", () => {
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("anyone@x.com")).toBe(false);
    if (prev == null) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });
});

describe("security: admin API is gated", () => {
  test("daily-insight route calls requireAdmin", () => {
    const src = readFileSync(
      join(ROOT, "src/app/api/admin/daily-insight/route.ts"),
      "utf8"
    );
    expect(src).toContain("requireAdmin");
    void requireAdmin;
  });
});
