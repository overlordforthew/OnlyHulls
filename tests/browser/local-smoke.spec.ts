import { expect, test, type Page } from "@playwright/test";

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
    specs: { loa: 45, rig_type: "catamaran", vessel_type: "catamaran" },
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
    specs: { loa: 42, rig_type: "catamaran", vessel_type: "catamaran" },
    character_tags: ["family-friendly"],
    source_site: "onlyhulls",
    source_name: "OnlyHulls",
    source_url: "https://onlyhulls.com/boats/2016-lagoon-42",
  },
];

async function mockBoatsResponse(page: Page) {
  await page.route("**/api/boats**", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const hullType = url.searchParams.get("hullType");

    let boats = mockBrowseBoats;

    if (query) {
      boats = boats.filter((boat) =>
        `${boat.year} ${boat.make} ${boat.model}`.toLowerCase().includes(query)
      );
    }

    if (hullType) {
      boats = boats.filter((boat) => boat.specs.vessel_type === hullType);
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boats, total: boats.length }),
    });
  });
}

async function mockCompareResponse(page: Page) {
  await page.route(/\/api\/boats\/compare(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        boats: mockBrowseBoats.map((boat, index) => ({
          ...boat,
          image_count: 6 - index,
          condition_score: 8 - index,
          specs: {
            ...boat.specs,
            beam: index === 0 ? 24 : 27,
            draft: index === 0 ? 4.5 : 5.2,
            cabins: index === 0 ? 3 : 4,
            berths: index === 0 ? 6 : 8,
            heads: index === 0 ? 2 : 3,
            hull_material: "Fiberglass",
          },
        })),
      }),
    });
  });
}

test("sell page serves nonce-based CSP and JSON-LD", async ({ page, request }) => {
  const response = await request.get("/sell");
  expect(response.ok()).toBeTruthy();

  const csp = response.headers()["content-security-policy"] || "";
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

  const html = await response.text();
  expect(html).toContain("application/ld+json");
  expect(html).toMatch(/<script[^>]*nonce=\"[^\"]+\"[^>]*application\/ld\+json/);

  await page.goto("/sell");
  await expect(page.getByRole("heading", { name: "Become a Creator", exact: false })).toBeVisible();
});

test("public diagnostics endpoints expose stable shapes", async ({ request }) => {
  const capabilitiesResponse = await request.get("/api/public/capabilities");
  expect(capabilitiesResponse.ok()).toBeTruthy();
  const capabilities = await capabilitiesResponse.json();

  expect(typeof capabilities.billingEnabled).toBe("boolean");
  expect(typeof capabilities.emailEnabled).toBe("boolean");
  expect(typeof capabilities.storageEnabled).toBe("boolean");
  expect(typeof capabilities.semanticMatchingEnabled).toBe("boolean");

  const deployHealthResponse = await request.get("/api/public/deploy-health");
  expect(deployHealthResponse.ok()).toBeTruthy();
  const deployHealth = await deployHealthResponse.json();

  expect(deployHealth.status).toBe("ok");
  expect(typeof deployHealth.version).toBe("string");
  expect(typeof deployHealth.buildSha).toBe("string");
  expect(typeof deployHealth.buildShaShort).toBe("string");
  expect(typeof deployHealth.buildBranch).toBe("string");
  expect(typeof deployHealth.servedAt).toBe("string");
});

test("sign in and sign up pages load", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible();

  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your account", exact: false })).toBeVisible();
});

test("pricing redirects into the sell pricing section", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/sell#pricing$/);
  await expect(page.getByRole("heading", { name: "Seller Plans", exact: false })).toBeVisible();
});

test("boats page search flow stays deterministic with mocked API data", async ({ page }) => {
  await mockBoatsResponse(page);

  await page.goto("/boats");
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Search boats...").fill("lagoon");
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Explore Search Hubs", { exact: true })).toHaveCount(0);
  await expect(page.getByText("2018 Lagoon 450 F", { exact: false })).toBeVisible();

  await page.getByTestId("boats-view-toggle-rows").click();
  await expect(page.getByTestId("boat-row-card").first()).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("boats-view-toggle-rows")).toHaveClass(/bg-primary-btn/);
  await expect(page.getByTestId("boat-row-card").first()).toBeVisible();
});

test("boats currency selection persists after reload locally", async ({ page }) => {
  await mockBoatsResponse(page);

  await page.goto("/boats");
  const currencySelector = page.locator("#boats-currency");
  await expect(currencySelector).toBeEnabled();
  await currencySelector.selectOption("EUR");
  await expect(currencySelector).toHaveValue("EUR");

  await page.reload();
  await expect(currencySelector).toBeEnabled();
  await expect(currencySelector).toHaveValue("EUR");
});

test("boats no-results state still offers recovery paths", async ({ page }) => {
  await page.route("**/api/boats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boats: [], total: 0 }),
    });
  });

  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.ok() && url.pathname === "/api/boats";
    }),
    page.goto("/boats?q=not-a-real-match"),
  ]);
  await expect(page.getByText("No hulls found", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters", exact: true })).toBeVisible();
  await expect(page.getByText("Try these live markets", { exact: true })).toBeVisible();
});

test("compare page renders a side-by-side comparison from mocked API data", async ({ page }) => {
  await mockCompareResponse(page);

  const compareRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/boats/compare";
  });

  await Promise.all([
    page.goto("/compare?ids=mock-lagoon-1,mock-lagoon-2"),
    compareRequest,
  ]);
  await expect(page.getByRole("heading", { name: "Side-by-side boat comparison", exact: false })).toBeVisible();
  await expect(page.getByText("Loading comparison...", { exact: false })).toHaveCount(0);
  await expect(page.getByTestId("compare-quick-read")).toBeVisible();
  await expect(page.getByText("Price per foot", { exact: true })).toBeVisible();
  await expect(page.getByText("Suggested first move", { exact: true })).toBeVisible();
});
