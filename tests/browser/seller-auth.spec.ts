import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const sellerEmail = process.env.PLAYWRIGHT_SELLER_EMAIL;
const sellerPassword = process.env.PLAYWRIGHT_SELLER_PASSWORD;

test.describe("seller auth flow", () => {
  test.skip(!sellerEmail || !sellerPassword, "Seller browser credentials are not configured.");

  async function signInAsSeller(page: Page) {
    await page.goto("/sign-in?callbackUrl=%2Flistings");
    await page.getByLabel("Email").fill(String(sellerEmail));
    await page.getByLabel("Password").fill(String(sellerPassword));
    await page.getByRole("button", { name: "Sign in", exact: false }).click();
    await expect(page).toHaveURL(/\/listings$/);
  }

  test("seller can access dashboard", async ({ page }) => {
    await signInAsSeller(page);
    await expect(page.getByRole("heading", { name: "Seller Dashboard", exact: false })).toBeVisible();
    await expect(page.getByText("Needs Attention", { exact: false })).toBeVisible();
    await expect(page.getByText("Recent Buyer Leads", { exact: false })).toBeVisible();
  });

  test("seller can open listing workspace", async ({ page }) => {
    await signInAsSeller(page);
    const manageButton = page.getByRole("link", { name: "Manage Listing", exact: false }).first();
    await expect(manageButton).toBeVisible();
    await manageButton.click();
    await expect(page.getByRole("heading", { name: "Manage Listing", exact: false })).toBeVisible();
    await expect(page.getByText("Readiness", { exact: false })).toBeVisible();
  });
});
