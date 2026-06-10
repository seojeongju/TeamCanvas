import { test, expect, bottomNav } from "./fixtures/auth";

test.describe("일정", () => {
  test("일정을 추가하고 캘린더에 표시된다", async ({ authedPage: page }) => {
    const title = `E2E 일정 ${Date.now()}`;

    await bottomNav(page).getByRole("link", { name: "일정", exact: true }).click();
    await page.getByLabel("일정 추가").click();
    await expect(page.getByRole("heading", { name: "일정 추가" })).toBeVisible();

    await page.getByLabel("제목").fill(title);

    const labels = page.getByText("라벨을 선택해 주세요.");
    if (await labels.isVisible().catch(() => false)) {
      const firstLabel = page.locator('[class*="rounded-full"]').first();
      if (await firstLabel.isVisible()) await firstLabel.click();
    }

    await page.getByRole("button", { name: "일정 저장" }).click();
    await expect(page.getByRole("heading", { name: "일정 추가" })).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });
});
