import { expect, type Page } from "@playwright/test";

export async function getCurrentOrgId(page: Page): Promise<string> {
  const res = await page.request.get("/auth/me");
  expect(res.ok()).toBeTruthy();
  const me = (await res.json()) as { organizations: { id: string }[] };
  expect(me.organizations.length).toBeGreaterThan(0);
  return me.organizations[0].id;
}

export async function createInviteToken(page: Page, label = "E2E invite"): Promise<string> {
  const orgId = await getCurrentOrgId(page);
  const res = await page.request.post(`/api/organizations/${orgId}/invites`, {
    data: { inviteType: "multi", label },
  });
  expect(res.ok(), `invite create failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { inviteUrl: string };
  const token = body.inviteUrl.split("/invite/")[1]?.split("?")[0];
  expect(token).toBeTruthy();
  return token!;
}

export async function loginDevUser(page: Page, email: string, name = "E2E User") {
  const res = await page.request.post("/auth/dev", {
    data: { provider: "google", email, name },
  });
  expect(res.ok()).toBeTruthy();
}
