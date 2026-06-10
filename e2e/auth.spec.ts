import { test, expect, loginViaDev, bottomNav } from "./fixtures/auth";

test.describe("인증", () => {
  test("dev 로그인 후 대시보드에 진입한다", async ({ page }) => {
    await loginViaDev(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(bottomNav(page).getByRole("link", { name: "일정", exact: true })).toBeVisible();
    await expect(bottomNav(page).getByRole("link", { name: "프로젝트", exact: true })).toBeVisible();
  });
});
