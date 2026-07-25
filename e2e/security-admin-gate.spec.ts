import { test, expect } from "@playwright/test";

/**
 * Gate C 15 — 관리자 API 권한 스모크.
 * 비로그인/비관리자는 403/401을 받는다.
 */
test.describe("security — admin API gate", () => {
  test("admin daily-insight rejects anonymous", async ({ request }) => {
    const res = await request.get(
      "/api/admin/daily-insight?date=2026-07-25"
    );
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/at\s+\S+\s+\(/);
  });

  test("account delete rejects missing confirmation", async ({ request }) => {
    const res = await request.post("/api/account/delete", {
      data: { confirmation: "yes" },
    });
    expect([400, 401]).toContain(res.status());
  });
});
