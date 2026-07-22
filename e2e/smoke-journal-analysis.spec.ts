import { test, expect } from "@playwright/test";
import { loadCredentials, loginIfPossible } from "./helpers";

test.describe("Phase 6.1 — journal + analysis (conservative flags)", () => {
  test("categories: select at least 4 and save", async ({ page }, testInfo) => {
    const cred = loadCredentials();
    test.skip(cred.mode === "skip_auth", cred.reason || "no credentials");
    const ok = await loginIfPossible(page, cred);
    if (!ok) {
      test.skip(true, "browser login session required for journal categories");
    }

    await page.goto("/journal/categories");
    // Gate should be open with E2E conservative flags
    await expect(page.getByText("새 일기 기능이 꺼져 있어요")).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: /선택/ }).first()
    ).toBeVisible({ timeout: 20_000 });

    const boxes = page.getByRole("checkbox", { name: /선택/ });
    const count = await boxes.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 4; i++) {
      const box = boxes.nth(i);
      if (!(await box.isChecked())) {
        await box.check();
      }
    }
    const saveBtn = page.getByRole("button", { name: /카테고리 저장/ });
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();
    await expect(page.getByText("저장됐어요. 과거 점수는 그대로 남아 있어요.")).toBeVisible({
      timeout: 15_000,
    });
    void testInfo;
  });

  test("journal write · scores · tag · reload · edit", async ({ page }) => {
    const cred = loadCredentials();
    test.skip(cred.mode === "skip_auth", cred.reason || "no credentials");
    if (!(await loginIfPossible(page, cred))) {
      test.skip(true, "browser login session required for journal write");
    }
    const marker = `${cred.marker} browser entry`;

    await page.goto("/journal/categories");
    const boxes = page.getByRole("checkbox", { name: /선택/ });
    await expect(boxes.first()).toBeVisible({ timeout: 20_000 });
    for (let i = 0; i < Math.min(4, await boxes.count()); i++) {
      const box = boxes.nth(i);
      if (!(await box.isChecked())) await box.check();
    }
    const saveCats = page.getByRole("button", { name: /카테고리 저장|저장/ });
    await saveCats.scrollIntoViewIfNeeded();
    await saveCats.click();
    await page.waitForTimeout(800);

    await page.goto("/journal");
    if (await page.getByText("카테고리 선택하기").isVisible().catch(() => false)) {
      await page.getByRole("link", { name: "카테고리 선택하기" }).click();
      const b2 = page.getByRole("checkbox", { name: /선택/ });
      for (let i = 0; i < 4; i++) {
        const box = b2.nth(i);
        if (!(await box.isChecked())) await box.check();
      }
      const save2 = page.getByRole("button", { name: /카테고리 저장|저장/ });
      await save2.scrollIntoViewIfNeeded();
      await save2.click();
      await page.goto("/journal");
    }

    await expect(page.getByText("■ 새 일기")).toBeVisible({ timeout: 20_000 });

    const dateInput = page.locator('input[type="date"]');
    const entryDate = await dateInput.inputValue();

    await page
      .getByText("하루 만족도")
      .locator("..")
      .getByRole("button", { name: "3", exact: true })
      .click();

    // Category score buttons use aria-label like "감정·만족도 보통"
    await page.getByRole("button", { name: /감정.*보통|감정.*3/ }).first().click();
    const naBtn = page.getByRole("button", { name: "해당 없음" }).nth(1);
    if (await naBtn.isVisible().catch(() => false)) {
      await naBtn.click();
    }

    const tag = page.getByRole("button", { name: /운동|휴식/ }).first();
    if (await tag.isVisible().catch(() => false)) {
      await tag.click();
    }

    await page.locator("textarea").first().fill(marker);
    await page.getByRole("button", { name: /저장|수정 저장/ }).last().click();
    await expect(page.getByText("저장됐어요.")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.locator("textarea").first()).toHaveValue(
      new RegExp(cred.runId)
    );

    await page.locator("textarea").first().fill(`${marker} edited`);
    await page.getByRole("button", { name: /저장|수정 저장/ }).last().click();
    await expect(page.getByText("저장됐어요.")).toBeVisible({ timeout: 20_000 });

    const d = new Date(`${entryDate}T12:00:00`);
    d.setUTCDate(d.getUTCDate() - 1);
    const other = d.toISOString().slice(0, 10);
    await dateInput.fill(other);
    await page.waitForTimeout(1200);
    const val = await page.locator("textarea").first().inputValue();
    expect(val.includes("edited")).toBe(false);
  });

  test("analysis daily shows deterministic panel (LLM OFF)", async ({ page }) => {
    await page.goto("/analysis/daily");
    await expect(page.getByLabel("분석 결과")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("명리 이론상")).toBeVisible();
    await expect(page.getByLabel("내 기록상")).toBeVisible();
    await expect(page.getByLabel("실천 제안")).toBeVisible();
    await expect(page.getByText("분석 화면이 꺼져 있어요")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/coefficient|userId|service_role/i);
  });

  test("analysis weekly + monthly panels render", async ({ page }) => {
    for (const path of ["/analysis/weekly", "/analysis/monthly"] as const) {
      await page.goto(path);
      await expect(page.getByLabel("분석 결과")).toBeVisible({ timeout: 30_000 });
    }
  });

  test("unauthenticated analysis shows fallback without crash", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/analysis/daily");
    const panel = page.getByLabel("분석 결과");
    const gate = page.getByText("분석 화면이 꺼져 있어요");
    await expect(panel.or(gate)).toBeVisible({ timeout: 30_000 });
  });
});
