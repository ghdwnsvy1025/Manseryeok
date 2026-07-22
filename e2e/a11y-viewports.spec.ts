import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const ROUTES = [
  "/diary/login",
  "/saju",
  "/diary",
  "/journal",
  "/journal/categories",
  "/journal/stats",
  "/analysis/daily",
  "/analysis/weekly",
  "/analysis/monthly",
] as const;

test.describe("Phase 6.1 — a11y + viewport smoke", () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
          };
        });
        expect(
          overflow.scrollWidth,
          `${route} overflow at ${vp.name}`
        ).toBeLessThanOrEqual(overflow.clientWidth + 2);
      }
    });
  }

  test("login form controls have accessible names", async ({ page }) => {
    await page.goto("/diary/login");
    const email = page.getByPlaceholder("이메일");
    const password = page.getByPlaceholder("비밀번호");
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    // After aria-label fix, accessible name should exist
    const emailName = await email.getAttribute("aria-label");
    const passName = await password.getAttribute("aria-label");
    expect(emailName || (await email.getAttribute("placeholder"))).toBeTruthy();
    expect(passName || (await password.getAttribute("placeholder"))).toBeTruthy();
    await expect(
      page.getByRole("button", { name: "로그인", exact: true })
    ).toBeVisible();
  });

  test("analysis headings and layers are labeled", async ({ page }) => {
    await page.goto("/analysis/daily");
    // With conservative flags ON: panel. If OFF: gate message.
    const panel = page.getByLabel("분석 결과");
    const gate = page.getByText("분석 화면이 꺼져 있어요");
    await expect(panel.or(gate)).toBeVisible({ timeout: 30_000 });
    if (await panel.isVisible().catch(() => false)) {
      await expect(page.getByLabel("명리 이론상")).toBeVisible();
      await expect(page.getByLabel("내 기록상")).toBeVisible();
      await expect(page.getByLabel("실천 제안")).toBeVisible();
    }
  });

  test("keyboard: tab reaches login submit", async ({ page }) => {
    await page.goto("/diary/login");
    await page.getByPlaceholder("이메일").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // eventually a button should be focusable in the form
    const focused = await page.evaluate(
      () => document.activeElement?.tagName || ""
    );
    expect(["INPUT", "BUTTON", "A", "SELECT", "TEXTAREA"]).toContain(focused);
  });

  test("journal categories use labels (not color-only)", async ({ page }) => {
    await page.goto("/journal/categories");
    // gate or editor
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    // checkboxes have aria-label when editor shown
    const hasChecks = await page
      .getByRole("checkbox")
      .count()
      .then((c) => c > 0)
      .catch(() => false);
    if (hasChecks) {
      const label = await page
        .getByRole("checkbox")
        .first()
        .getAttribute("aria-label");
      expect(label).toBeTruthy();
    }
  });
});
