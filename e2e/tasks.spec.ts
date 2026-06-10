import { test, expect, bottomNav } from "./fixtures/auth";

test.describe("프로젝트", () => {
  test("프로젝트를 추가하고 목록에 표시된다", async ({ authedPage: page }) => {
    const title = `E2E 프로젝트 ${Date.now()}`;

    await bottomNav(page).getByRole("link", { name: "프로젝트", exact: true }).click();
    await page.getByLabel("프로젝트 추가").click();
    await expect(page.getByRole("heading", { name: "프로젝트 추가" })).toBeVisible();

    await page.getByLabel("프로젝트 제목").fill(title);
    await page.getByRole("button", { name: "프로젝트 저장" }).click();

    await expect(page.getByRole("heading", { name: "프로젝트 추가" })).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });
});
