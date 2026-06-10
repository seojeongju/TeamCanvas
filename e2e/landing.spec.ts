import { test, expect } from "@playwright/test";

test.describe("랜딩 페이지", () => {
  test("비로그인 사용자에게 TeamCanvas 소개가 표시된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("TeamCanvas", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /시작|로그인|가입/i }).first()).toBeVisible();
  });
});
