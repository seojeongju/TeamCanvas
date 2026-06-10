import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest.webmanifest가 유효하다", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();

    const manifest = (await res.json()) as {
      name?: string;
      short_name?: string;
      display?: string;
      start_url?: string;
      icons?: { src: string; sizes: string }[];
    };

    expect(manifest.name).toBe("TeamCanvas");
    expect(manifest.short_name).toBe("TeamCanvas");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons?.length).toBeGreaterThan(0);
  });

  test("index.html에 manifest 링크가 있다", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('link[rel="manifest"]');
    await expect(link).toHaveAttribute("href", /manifest\.webmanifest/);
  });
});
