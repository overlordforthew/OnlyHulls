import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/", heading: "Find Your Perfect Hull" },
  { path: "/boats", heading: "Browse Boats" },
  { path: "/match", heading: "Your Perfect Match is Waiting" },
  { path: "/sell", heading: "Become a Creator" },
];

for (const pageCase of publicPages) {
  test(`public page loads: ${pageCase.path}`, async ({ page }) => {
    await page.goto(pageCase.path);
    await expect(page).toHaveURL(/onlyhulls\.com/);
    await expect(page.getByRole("heading", { name: pageCase.heading, exact: false })).toBeVisible();
  });
}

test("pricing redirects to sell section", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/sell#pricing$/);
  await expect(page.getByRole("heading", { name: "Seller Plans", exact: false })).toBeVisible();
});

test("authenticated areas redirect guests to sign in", async ({ page }) => {
  await page.goto("/listings");
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible();
  expect(decodeURIComponent(page.url())).toContain("/listings");
});

test("sign in page loads", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible();
});

test("sign up page loads", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { name: "Create your account", exact: false })).toBeVisible();
});

test("match CTA preserves auth callback for guests", async ({ page }) => {
  await page.goto("/match");
  await page.getByRole("button", { name: "Get Matched - It's Free" }).click();
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);

  const url = page.url();
  expect(decodeURIComponent(url)).toContain("/onboarding/profile?callbackUrl=/matches");
});

test("capabilities endpoint reports live systems", async ({ request }) => {
  const response = await request.get("/api/public/capabilities");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.billingEnabled).toBe(true);
  expect(body.emailEnabled).toBe(true);
  expect(body.storageEnabled).toBe(true);
  expect(body.semanticMatchingEnabled).toBe(true);
});

test("boats search returns results and renders the page", async ({ page, request }) => {
  const api = await request.get("/api/boats?q=Leopard");
  expect(api.ok()).toBeTruthy();
  const payload = await api.json();
  expect(payload.total).toBeGreaterThan(0);

  await page.goto("/boats?q=Leopard");
  await expect(page).toHaveURL(/\/boats\?q=Leopard$/);
  await expect(page.getByText("Leopard", { exact: false }).first()).toBeVisible();
});
