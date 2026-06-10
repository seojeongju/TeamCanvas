import { test as base, expect, type Page } from "@playwright/test";

async function completeOnboardingIfNeeded(page: Page) {
  if (!page.url().includes("/onboarding")) return;
  await page.getByLabel("조직 이름").fill(`E2E Org ${Date.now()}`);
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 15_000 });
}

export async function loginViaDev(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teamcanvas.test`;
  const res = await page.request.post("/auth/dev", {
    data: { provider: "google", email, name: "E2E Tester" },
  });
  expect(res.ok(), `dev login failed: ${res.status()}`).toBeTruthy();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await completeOnboardingIfNeeded(page);
  await expect(bottomNav(page).getByRole("link", { name: "홈", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  return { email };
}

export function bottomNav(page: Page) {
  return page.getByRole("navigation");
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginViaDev(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
