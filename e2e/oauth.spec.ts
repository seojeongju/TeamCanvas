import { test, expect } from "@playwright/test";

test.describe("OAuth", () => {
  test("로그인 페이지에 Google·카카오 버튼이 표시된다", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Google로 계속하기/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /카카오로 계속하기/ })).toBeVisible();
  });

  test("/auth/providers API가 provider 상태를 반환한다", async ({ request }) => {
    const res = await request.get("/auth/providers");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { google: boolean; kakao: boolean };
    expect(typeof body.google).toBe("boolean");
    expect(typeof body.kakao).toBe("boolean");
  });

  test("dev OAuth 시뮬레이션(google provider)으로 세션을 만든다", async ({ page }) => {
    const email = `oauth-${Date.now()}@teamcanvas.test`;
    const login = await page.request.post("/auth/dev", {
      data: { provider: "google", email, name: "OAuth E2E" },
    });
    expect(login.ok()).toBeTruthy();

    const me = await page.request.get("/auth/me");
    expect(me.ok()).toBeTruthy();
    const body = (await me.json()) as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  test("Google OAuth 미설정 시 /auth/google이 오류를 반환한다", async ({ request }) => {
    const res = await request.get("/auth/google", { maxRedirects: 0 });
    expect([302, 503]).toContain(res.status());
  });
});
