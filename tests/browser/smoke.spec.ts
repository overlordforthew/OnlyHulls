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

  const url = new URL(page.url());
  const callbackUrl = url.searchParams.get("callbackUrl");
  expect(callbackUrl).toBe("/onboarding/profile?callbackUrl=%2Fmatches");
});

test("seller onboarding route redirects guests to sign in", async ({ page }) => {
  await page.goto("/onboarding?role=seller");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible();
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
  await expect(page.getByTestId("boat-location").first()).toBeVisible();
});

test("boats API honors price sorting for search queries", async ({ request }) => {
  const api = await request.get("/api/boats?q=catana&sort=price&dir=asc&limit=12");
  expect(api.ok()).toBeTruthy();

  const payload = await api.json();
  expect(payload.boats.length).toBeGreaterThan(2);

  const prices = payload.boats
    .map((boat: { asking_price_usd?: number | null; asking_price?: number | null }) =>
      Number(boat.asking_price_usd ?? boat.asking_price ?? Number.POSITIVE_INFINITY)
    )
    .filter((price: number) => Number.isFinite(price));

  expect(prices.length).toBeGreaterThan(2);

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});

test("boats page shows ascending prices when sorting by price", async ({ page }) => {
  await page.goto("/boats?q=catana");
  await page.getByRole("button", { name: "Price", exact: false }).click();
  await page.waitForLoadState("networkidle");

  const cardTexts = await page.locator("div.group.card-hover").evaluateAll((cards) =>
    cards.slice(0, 6).map((card) => card.textContent || "")
  );

  const prices = cardTexts
    .map((text) => {
      const match = text.match(/\$([\d,]+)/);
      return match ? Number(match[1].replace(/,/g, "")) : Number.NaN;
    })
    .filter((price) => Number.isFinite(price));

  expect(prices.length).toBeGreaterThan(2);

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});

test("boats page load more appends additional cards", async ({ page }) => {
  await page.goto("/boats");
  const cards = page.locator("div.group.card-hover");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(5);

  const showMore = page.getByRole("button", { name: /Show More/i });
  await expect(showMore).toBeVisible();
  await showMore.click();

  await expect.poll(async () => cards.count()).toBeGreaterThan(initialCount);
});

test("boats currency selection persists after reload", async ({ page }) => {
  await page.goto("/boats");
  await page.locator("#boats-currency").selectOption("EUR");
  await expect(page.locator("#boats-currency")).toHaveValue("EUR");

  await page.reload();
  await expect(page.locator("#boats-currency")).toHaveValue("EUR");
});

test("boats card opens detail page", async ({ page }) => {
  await page.goto("/boats?q=lagoon");

  const firstCardTitle = page.locator("div.group.card-hover h3").first();
  await expect(firstCardTitle).toBeVisible();
  const title = (await firstCardTitle.textContent())?.trim();
  expect(title).toBeTruthy();

  await firstCardTitle.click();
  await expect(page).toHaveURL(/\/boats\//);
  await expect(page.getByRole("heading", { name: title!, exact: false })).toBeVisible();
});
