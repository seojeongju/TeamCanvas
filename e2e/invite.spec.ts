import { test, expect } from "./fixtures/auth";
import { createInviteToken, loginDevUser } from "./fixtures/invite";

test.describe("초대 링크", () => {
  test("멀티 초대 링크를 생성하고 새 사용자가 수락한다", async ({
    browser,
    authedPage: hostPage,
  }) => {
    const token = await createInviteToken(hostPage);

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    const guestEmail = `e2e-guest-${Date.now()}@teamcanvas.test`;
    await loginDevUser(guestPage, guestEmail, "초대 게스트");
    await guestPage.goto("/login");
    await guestPage.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });

    await guestPage.goto(`/invite/${token}`);
    await expect(guestPage.getByText("초대 수락").or(guestPage.getByRole("button", { name: "초대 수락" }))).toBeVisible({
      timeout: 10_000,
    });
    await expect(guestPage.getByText("유효하지 않은 초대")).toHaveCount(0);

    await guestPage.getByRole("button", { name: "초대 수락" }).click();
    await guestPage.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
    await expect(guestPage.getByRole("navigation").getByRole("link", { name: "홈", exact: true })).toBeVisible();

    await guestContext.close();
  });
});
