import { test, expect, bottomNav } from "./fixtures/auth";

test.describe("AI 일정 제안", () => {
  test("규칙 기반 시간 제안을 받을 수 있다", async ({ authedPage: page }) => {
    await bottomNav(page).getByRole("link", { name: "일정", exact: true }).click();
    await page.getByLabel("일정 추가").click();
    await expect(page.getByRole("heading", { name: "일정 추가" })).toBeVisible();

    await page.getByPlaceholder("예: 다음 주 팀 회의").fill("다음 주 팀 회의 잡아줘");
    await page.getByRole("button", { name: "시간 제안 받기" }).click();

    await expect(
      page.getByText(/규칙 기반 추천|Workers AI가 추천한 시간/).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("팀 회의").first()).toBeVisible();
  });
});
