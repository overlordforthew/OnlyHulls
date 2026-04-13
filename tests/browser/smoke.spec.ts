import { expect, test, type Page } from "@playwright/test";

const publicPages = [
  { path: "/", heading: "Find Your Perfect Hull" },
  { path: "/boats", heading: "Browse Boats" },
  { path: "/match", heading: "Your Perfect Match is Waiting" },
  { path: "/sell", heading: "Become a Creator" },
  { path: "/compare", heading: "Side-by-side boat comparison" },
  { path: "/catamarans-for-sale", heading: "Catamarans for Sale" },
  { path: "/sailboats-for-sale", heading: "Sailboats for Sale" },
  { path: "/boats/make/bali", heading: "Bali Boats for Sale" },
  { path: "/boats/location/puerto-rico", heading: "Boats for Sale in Puerto Rico" },
];

const errorBoundaryMessages = [
  "An unexpected error occurred. Please try again, or go back to the homepage.",
  "We had trouble loading this page. Please try again.",
];

const mockBrowseBoats = [
  {
    id: "mock-lagoon-1",
    make: "Lagoon",
    model: "450 F",
    year: 2018,
    asking_price: 495000,
    currency: "USD",
    asking_price_usd: 495000,
    location_text: "Puerto Rico",
    slug: "2018-lagoon-450-f",
    is_sample: false,
    hero_url: null,
    specs: { loa: 45, rig_type: "catamaran" },
    character_tags: ["bluewater", "liveaboard-ready"],
    source_site: "onlyhulls",
    source_name: "OnlyHulls",
    source_url: "https://onlyhulls.com/boats/2018-lagoon-450-f",
  },
  {
    id: "mock-lagoon-2",
    make: "Lagoon",
    model: "42",
    year: 2016,
    asking_price: 369000,
    currency: "USD",
    asking_price_usd: 369000,
    location_text: "Florida",
    slug: "2016-lagoon-42",
    is_sample: false,
    hero_url: null,
    specs: { loa: 42, rig_type: "catamaran" },
    character_tags: ["family-friendly"],
    source_site: "onlyhulls",
    source_name: "OnlyHulls",
    source_url: "https://onlyhulls.com/boats/2016-lagoon-42",
  },
];

async function expectHealthyPublicPage(page: Page, path: string, heading: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  expect(new URL(page.url()).pathname).toBe(path);
  await expect(page.getByRole("heading", { name: heading, exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Something went wrong", exact: false })
  ).toHaveCount(0);

  for (const message of errorBoundaryMessages) {
    await expect(page.getByText(message, { exact: false })).toHaveCount(0);
  }
}

for (const pageCase of publicPages) {
  test(`public page loads: ${pageCase.path}`, async ({ page }) => {
    await expectHealthyPublicPage(page, pageCase.path, pageCase.heading);
  });
}

test("pricing redirects to sell section", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/sell#pricing$/);
  await expect(page.getByRole("heading", { name: "Seller Plans", exact: false })).toBeVisible();
});

test("sign in page loads", async ({ page }) => {
  await expectHealthyPublicPage(page, "/sign-in", "Welcome back");
});

test("sign up page loads", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { name: "Create your account", exact: false })).toBeVisible();
});

test("public pages expose the WhatsApp contact button", async ({ page }) => {
  await page.goto("/");
  const button = page.getByTestId("whatsapp-contact-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("href", /wa\.me\/18587794588/);
  await expect(button).toHaveAttribute("target", "_blank");
});

test("match CTA preserves auth callback for guests", async ({ page }) => {
  await page.goto("/match");
  await expect(page.getByTestId("match-start-signals")).toBeVisible();
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

test("boats search hides SEO hub links once a real query is active", async ({ page }) => {
  await page.goto("/boats?q=catana");
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Catana", { exact: false }).first()).toBeVisible();
});

test("boats search hubs stay visible until a draft query is submitted", async ({ page }) => {
  await page.route("**/api/boats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        boats: mockBrowseBoats,
        total: mockBrowseBoats.length,
      }),
    });
  });

  await page.goto("/boats");
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Search boats...").fill("lagoon");
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toHaveCount(0);
  await expect(page.getByText("2018 Lagoon 450 F", { exact: false })).toBeVisible();
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
  const api = await page.request.get("/api/boats?q=catana&sort=price&dir=asc&limit=12");
  expect(api.ok()).toBeTruthy();

  const payload = await api.json();
  const expectedHeadings = payload.boats
    .map((boat: { year?: number | null; make?: string | null; model?: string | null }) =>
      [boat.year, boat.make, boat.model].filter(Boolean).join(" ").trim()
    )
    .filter((heading: string) => heading.length > 0)
    .slice(0, 6);

  expect(expectedHeadings.length).toBeGreaterThan(2);

  const cardHeadings = page.locator("div.group.card-hover h3");

  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === "/api/boats"
        && url.searchParams.get("q") === "catana"
        && url.searchParams.get("sort") === "newest"
        && url.searchParams.get("dir") === "desc";
    }),
    page.goto("/boats?q=catana"),
  ]);

  await expect.poll(async () => cardHeadings.count(), { timeout: 15_000 }).toBeGreaterThan(0);

  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok()
        && url.pathname === "/api/boats"
        && url.searchParams.get("q") === "catana"
        && url.searchParams.get("sort") === "price"
        && url.searchParams.get("dir") === "asc";
    }),
    page.getByRole("button", { name: "Price", exact: false }).click(),
  ]);

  await expect
    .poll(async () => {
      const visibleCount = await cardHeadings.count();
      return cardHeadings.evaluateAll(
        (headings, limit) =>
          headings
            .slice(0, Math.min(headings.length, limit))
            .map((heading) => heading.textContent?.trim() || "")
            .filter((heading) => heading.length > 0),
        Math.min(visibleCount, expectedHeadings.length)
      );
    }, { timeout: 15_000 })
    .toEqual(expectedHeadings);
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

test("boats page can switch to row view and persist it", async ({ page }) => {
  await page.route("**/api/boats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        boats: mockBrowseBoats,
        total: mockBrowseBoats.length,
      }),
    });
  });

  await page.goto("/boats?q=lagoon");

  await expect(page.locator("div.group.card-hover").first()).toBeVisible();
  await page.getByTestId("boats-view-toggle-rows").click();
  await expect(page.getByTestId("boat-row-card").first()).toBeVisible();
  await expect(page.getByTestId("boat-row-location").first()).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("boats-view-toggle-rows")).toHaveClass(/bg-primary-btn/);
  await expect(page.getByTestId("boat-row-card").first()).toBeVisible();
});

test("boats currency selection persists after reload", async ({ page }) => {
  await page.goto("/boats");
  await page.locator("#boats-currency").selectOption("EUR");
  await expect(page.locator("#boats-currency")).toHaveValue("EUR");

  await page.reload();
  await expect(page.locator("#boats-currency")).toHaveValue("EUR");
});

test("boats no-results state offers recovery paths", async ({ page }) => {
  await page.route("**/api/boats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boats: [], total: 0 }),
    });
  });

  await page.goto("/boats?q=not-a-real-match");
  await expect(page.getByText("No hulls found", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters", exact: true })).toBeVisible();
  await expect(page.getByText("Try these live markets", { exact: true })).toBeVisible();
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

test("boats can be added to compare and rendered side by side", async ({ page }) => {
  await page.goto("/boats?q=lagoon");
  const compareButtons = page.getByTestId("boat-compare-toggle");
  await expect(compareButtons.nth(0)).toBeVisible();
  await compareButtons.nth(0).click();
  await compareButtons.nth(1).click();

  await page.goto("/compare");
  await expect(page.getByRole("heading", { name: "Side-by-side boat comparison", exact: false })).toBeVisible();
  await expect(page.getByText("Decision signal", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start browsing/i })).toHaveCount(0);
});

test("make SEO hub loads", async ({ page }) => {
  await page.goto("/boats/make/lagoon");
  await expect(page.getByRole("heading", { name: "Lagoon Boats for Sale", exact: false })).toBeVisible();
  await expect(page.getByText("Related boat searches", { exact: false })).toBeVisible();
});

test("location SEO hub loads", async ({ page }) => {
  await page.goto("/boats/location/florida");
  await expect(page.getByRole("heading", { name: "Boats for Sale in Florida", exact: false })).toBeVisible();
  await expect(page.getByText("live Florida listings", { exact: false })).toBeVisible();
});

test("match page renders buyer faq content", async ({ page }) => {
  await page.goto("/match");
  await expect(page.getByRole("heading", { name: "Questions buyers usually ask before they start matching", exact: false })).toBeVisible();
  await expect(page.getByText("How does OnlyHulls decide what is a good match?", { exact: false })).toBeVisible();
});

test("match page surfaces current matching stack status", async ({ page, request }) => {
  const response = await request.get("/api/public/capabilities");
  expect(response.ok()).toBeTruthy();
  const capabilities = await response.json();

  await page.goto("/match");
  await expect(page.getByTestId("match-stack-status")).toBeVisible();

  if (capabilities.matchIntelligenceEnabled) {
    await expect(page.getByText("AI matching is live", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("Smart matching is active", { exact: true })).toBeVisible();
  }

  if (capabilities.semanticMatchingEnabled) {
    await expect(page.getByText("Semantic ranking is on", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("Spec ranking is on", { exact: true })).toBeVisible();
  }

  await expect(page.getByText("Your matches stay saved", { exact: true })).toBeVisible();
});

test("sell page renders seller faq content", async ({ page }) => {
  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: "The practical questions sellers ask before they list", exact: false })).toBeVisible();
  await expect(page.getByText("How long does a paid seller plan last?", { exact: false })).toBeVisible();
});

test("boat detail page shows related discovery sections", async ({ page }) => {
  await page.goto("/boats?q=lagoon");

  const firstCardTitle = page.locator("div.group.card-hover h3").first();
  await expect(firstCardTitle).toBeVisible();
  await firstCardTitle.click();

  await expect(page).toHaveURL(/\/boats\//);
  await expect(page.getByText("Listing trust", { exact: true })).toBeVisible();
  await expect(page.getByText("Photos", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Similar boats to consider", exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keep browsing this market", exact: false })).toBeVisible();
});
