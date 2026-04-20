import { expect, test, type Page } from "@playwright/test";

const MAP_SHELL_TIMEOUT_MS = 15_000;

type MockMapMarkerBoat = {
  slug: string;
  title: string;
  locationText: string;
  lat: number;
  lng: number;
  precision: "exact" | "marina" | "street";
  approximate: boolean;
  askingPrice: number | null;
  currency: string;
  askingPriceUsd: number | null;
  heroUrl: string | null;
  loa: number | null;
};

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

const mockMapMarkerBoats: MockMapMarkerBoat[] = [
  {
    slug: "2018-lagoon-450-f",
    title: "2018 Lagoon 450 F",
    locationText: "Fajardo, Puerto Rico",
    lat: 18.3358,
    lng: -65.6319,
    precision: "marina",
    approximate: false,
    askingPrice: 495000,
    currency: "USD",
    askingPriceUsd: 495000,
    heroUrl: "https://images.example.test/lagoon-450.jpg",
    loa: 45,
  },
];

const mockDenseMapMarkerBoats: MockMapMarkerBoat[] = [
  ...mockMapMarkerBoats,
  {
    slug: "2019-leopard-45",
    title: "2019 Leopard 45",
    locationText: "Fajardo, Puerto Rico",
    lat: 18.3458,
    lng: -65.6419,
    precision: "marina",
    approximate: false,
    askingPrice: 610000,
    currency: "USD",
    askingPriceUsd: 610000,
    heroUrl: null,
    loa: 45,
  },
  {
    slug: "2020-bali-4-6",
    title: "2020 Bali 4.6",
    locationText: "Fajardo, Puerto Rico",
    lat: 18.3658,
    lng: -65.6519,
    precision: "marina",
    approximate: false,
    askingPrice: 720000,
    currency: "USD",
    askingPriceUsd: 720000,
    heroUrl: null,
    loa: 46,
  },
];

const mockTwoMapMarkerBoats: MockMapMarkerBoat[] = [
  ...mockMapMarkerBoats,
  {
    slug: "2019-leopard-45",
    title: "2019 Leopard 45",
    locationText: "Ceiba, Puerto Rico",
    lat: 18.3058,
    lng: -65.5919,
    precision: "marina",
    approximate: false,
    askingPrice: 610000,
    currency: "USD",
    askingPriceUsd: 610000,
    heroUrl: null,
    loa: 45,
  },
];

const mockOverflowMapMarkerBoats: MockMapMarkerBoat[] = Array.from({ length: 8 }, (_, index) => ({
  slug: `map-overflow-${index}`,
  title: `Map Overflow ${index}`,
  locationText: "Fajardo, Puerto Rico",
  lat: 18.31 + (index % 4) * 0.012,
  lng: -65.67 + Math.floor(index / 4) * 0.05,
  precision: "marina",
  approximate: false,
  askingPrice: 400000 + index * 10000,
  currency: "USD",
  askingPriceUsd: 400000 + index * 10000,
  heroUrl: null,
  loa: 40 + index,
}));

async function mockBoatsResponse(page: Page) {
  await page.route(/\/api\/boats\/location-markets(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ counts: { "puerto-rico": 1, florida: 1 } }),
    });
  });

  await page.route(/\/api\/boats(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const location = (url.searchParams.get("location") || "").toLowerCase().replace(/-/g, " ");
    const hullType = url.searchParams.get("hullType");

    let boats = mockBrowseBoats;

    if (query) {
      boats = boats.filter((boat) =>
        `${boat.year} ${boat.make} ${boat.model}`.toLowerCase().includes(query)
      );
    }

    if (location) {
      boats = boats.filter((boat) =>
        String(boat.location_text || "").toLowerCase().includes(location)
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

async function mockMapStyle(page: Page) {
  await page.route("https://images.example.test/lagoon-450.jpg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"),
    });
  });

  await page.route("https://tiles.example.test/style.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#10202b" },
          },
        ],
      }),
    });
  });
}

async function mockBrokenMapStyle(page: Page) {
  await page.route("https://tiles.example.test/style.json", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "style unavailable" }),
    });
  });
}

async function mockMapMarkersResponse(
  page: Page,
  onRequest?: (url: URL) => void,
  boats = mockMapMarkerBoats
) {
  await page.route(/\/api\/boats\/map(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    onRequest?.(url);
    expect(url.searchParams.get("bbox")).toBeTruthy();
    expect(url.searchParams.get("location")).toBe("puerto-rico");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        boats,
        returned: boats.length,
        hasMore: false,
        limit: 150,
      }),
    });
  });
}

async function mockRateLimitedMapMarkersResponse(page: Page) {
  await page.route(/\/api\/boats\/map(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 429,
      headers: { "Retry-After": "60" },
      contentType: "application/json",
      body: JSON.stringify({ error: "Too many map requests. Please try again shortly." }),
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

test("boats page location search creates a shareable chip and URL", async ({ page }) => {
  await mockBoatsResponse(page);

  await page.goto("/boats");
  await page.getByTestId("boats-location-input").fill("Puerto Rico");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/location=puerto-rico/);
  await expect(page.getByText("Location: Puerto Rico", { exact: true })).toBeVisible();
  await expect(page.getByText("2018 Lagoon 450 F", { exact: false })).toBeVisible();
  await expect(page.getByText("2016 Lagoon 42", { exact: false })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear location", exact: true }).click();
  await expect(page).not.toHaveURL(/location=/);
  await expect(page.getByText("2016 Lagoon 42", { exact: false })).toBeVisible();
});

test("boats map toggle stays hidden when public map capability is off", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED === "true", "map-on run verifies the enabled state");
  await mockBoatsResponse(page);

  await page.goto("/boats?view=map&mapCenter=18.25000,-66.45000&mapZoom=8.00");
  await expect(page.getByTestId("boats-view-toggle-grid")).toBeVisible();
  await expect(page.getByTestId("boats-view-toggle-rows")).toBeVisible();
  await expect(page.getByTestId("boats-view-toggle-map")).toHaveCount(0);
  await expect(page.getByTestId("boats-map-copy-link")).toHaveCount(0);
  await expect(page.getByTestId("boats-map-recenter")).toHaveCount(0);
  await expect(page.getByTestId("boats-map-reset-view")).toHaveCount(0);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("view"))
    .toBeNull();
  const strippedUrl = new URL(page.url());
  expect(strippedUrl.searchParams.get("mapCenter")).toBeNull();
  expect(strippedUrl.searchParams.get("mapZoom")).toBeNull();
});

test("boats map view fetches precise markers and links back to listings", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockMapMarkersResponse(page);

  await page.goto("/boats?location=puerto-rico");
  await page.getByTestId("boats-view-toggle-map").click();

  await expect(page.getByTestId("boats-map-canvas")).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });
  await expect(page.getByTestId("boats-map-listing").first()).toContainText("2018 Lagoon 450 F", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect(page.getByTestId("boats-map-listing-price").first()).toHaveText("$495,000");
  await expect(page.getByTestId("boats-map-listing-image").first()).toHaveAttribute(
    "loading",
    "lazy"
  );
  await expect(page.getByTestId("boats-map-listing-image").first()).toHaveAttribute(
    "src",
    "https://images.example.test/lagoon-450.jpg"
  );
  await expect(page.getByTestId("boats-map-listing").first()).toContainText("45 ft");
  await expect(page.getByTestId("boats-map-listing").first()).toContainText("Fajardo, Puerto Rico", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await page.getByTestId("boats-map-marker").first().click();
  await expect(page.getByTestId("boats-map-popup-price")).toHaveText("$495,000", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect(page.getByTestId("boats-map-popup-image")).toHaveAttribute(
    "src",
    "https://images.example.test/lagoon-450.jpg"
  );
  await expect(page.getByTestId("boats-map-marker").first()).toHaveAttribute(
    "data-selected",
    "true"
  );
  await expect(page.getByTestId("boats-map-listing").first()).toHaveAttribute(
    "data-selected",
    "true"
  );
  const urlBeforePopupClose = page.url();
  await page.locator(".maplibregl-popup-close-button").click();
  await expect(page.getByTestId("boats-map-popup")).toHaveCount(0);
  expect(page.url()).toBe(urlBeforePopupClose);
  await expect(page.getByTestId("boats-map-marker").first()).toHaveAttribute(
    "data-selected",
    "false"
  );
  await expect(page.getByTestId("boats-map-listing").first()).toHaveAttribute(
    "data-selected",
    "false"
  );
  await page.getByTestId("boats-map-listing").first().getByRole("button").click();
  await expect(page.getByTestId("boats-map-popup-price")).toHaveText("$495,000", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect(page.getByRole("link", { name: "View listing", exact: true }).first()).toHaveAttribute(
    "href",
    "/boats/2018-lagoon-450-f"
  );
});

test("boats map clusters dense marker markets and expands clusters", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockMapMarkersResponse(page, undefined, mockDenseMapMarkerBoats);

  await page.goto("/boats?location=puerto-rico&view=map&mapCenter=18.35000,-65.70000&mapZoom=7.00");

  const cluster = page.getByTestId("boats-map-cluster").first();
  await expect(cluster).toHaveText("3", { timeout: MAP_SHELL_TIMEOUT_MS });
  await expect(cluster).toHaveAttribute("aria-label", "3 boats in this area. Zoom in to expand.");
  await expect(cluster).not.toContainText("Lagoon");
  await expect(page.getByTestId("boats-map-marker")).toHaveCount(0);

  await cluster.click();
  await expect(page.getByTestId("boats-map-cluster").filter({ hasText: "3" })).toHaveCount(0, {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect.poll(() => page.getByTestId("boats-map-marker").count()).toBeGreaterThan(0);
});

test("boats map markers support keyboard popup activation", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockMapMarkersResponse(page);

  await page.goto("/boats?location=puerto-rico&view=map&mapCenter=18.35000,-65.70000&mapZoom=10.00");
  const marker = page.getByTestId("boats-map-marker").first();
  await expect(marker).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });

  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("boats-map-popup")).toContainText("2018 Lagoon 450 F", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await page.locator(".maplibregl-popup-close-button").click();
  await expect(page.getByTestId("boats-map-popup")).toHaveCount(0);

  await marker.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("boats-map-popup")).toContainText("2018 Lagoon 450 F", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
});

test("boats map marker selection replaces popups cleanly", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockMapMarkersResponse(page, undefined, mockTwoMapMarkerBoats);

  await page.goto("/boats?location=puerto-rico&view=map&mapCenter=18.35000,-65.65000&mapZoom=12.00");
  await expect(page.getByTestId("boats-map-marker")).toHaveCount(2, {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });

  await page.getByTestId("boats-map-marker").first().click();
  await expect(page.getByTestId("boats-map-popup")).toContainText("2018 Lagoon 450 F", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect(page.getByTestId("boats-map-popup")).toHaveCount(1);

  await page.getByTestId("boats-map-marker").nth(1).click();
  await expect(page.getByTestId("boats-map-popup")).toContainText("2019 Leopard 45", {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });
  await expect(page.getByTestId("boats-map-popup")).toHaveCount(1);
  await expect(page.getByTestId("boats-map-listing").nth(1)).toHaveAttribute(
    "data-selected",
    "true"
  );
});

test("boats map marker selection scrolls the sidebar row into view", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockMapMarkersResponse(page, undefined, mockOverflowMapMarkerBoats);

  await page.goto("/boats?location=puerto-rico&view=map&mapCenter=18.33500,-65.64500&mapZoom=13.00");
  await expect(page.getByTestId("boats-map-marker")).toHaveCount(8, {
    timeout: MAP_SHELL_TIMEOUT_MS,
  });

  await page.getByTestId("boats-map-shell").scrollIntoViewIfNeeded();
  const scrollContainer = page.getByTestId("boats-map-list-scroll");
  await scrollContainer.evaluate((element) => {
    element.scrollTop = 0;
  });
  const pageScrollBefore = await page.evaluate(() => window.scrollY);

  const marker = page.getByTestId("boats-map-marker").last();
  await marker.dispatchEvent("pointerdown", { clientX: 10, clientY: 10 });
  await marker.dispatchEvent("pointerup", { clientX: 10, clientY: 10 });

  await expect
    .poll(() => scrollContainer.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
  await expect(page.getByTestId("boats-map-listing").last()).toHaveAttribute(
    "data-selected",
    "true",
    { timeout: MAP_SHELL_TIMEOUT_MS }
  );
});

test("boats map URL state opens shared map links and updates after zoom", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { __copiedMapLink?: string }).__copiedMapLink = value;
        },
      },
    });
  });
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  const markerRequests: URL[] = [];
  await mockMapMarkersResponse(page, (url) => markerRequests.push(url));

  await page.goto("/boats?location=puerto-rico&view=map&mapCenter=18.35000,-65.70000&mapZoom=10.00");
  await expect(page.getByTestId("boats-map-shell")).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });
  await expect(page.getByTestId("boats-view-toggle-map")).toHaveClass(/bg-primary-btn/);
  await expect(page.getByTestId("boats-map-listing").first()).toContainText("2018 Lagoon 450 F");

  await expect.poll(() => markerRequests.length).toBeGreaterThan(0);
  const firstBbox = markerRequests[0].searchParams.get("bbox");
  expect(firstBbox).toBeTruthy();
  const [west, south, east, north] = firstBbox!.split(",").map(Number);
  expect(east - west).toBeLessThan(1.2);
  expect(north - south).toBeLessThan(1.2);
  expect(west).toBeLessThan(-65.7);
  expect(east).toBeGreaterThan(-65.7);
  expect(south).toBeLessThan(18.35);
  expect(north).toBeGreaterThan(18.35);

  const historyLengthBeforeZoom = await page.evaluate(() => window.history.length);
  await page.locator(".maplibregl-ctrl-zoom-in").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("mapZoom"))
    .not.toBe("10.00");
  expect(new URL(page.url()).searchParams.get("view")).toBe("map");
  expect(await page.evaluate(() => window.history.length)).toBe(historyLengthBeforeZoom);

  await page.getByTestId("boats-map-copy-link").click();
  await expect(page.getByText("Map link copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copiedMapLink?: string }).__copiedMapLink)).toBe(
    page.url()
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.execCommand = (command: string) => {
      (window as unknown as { __fallbackCopyCommand?: string }).__fallbackCopyCommand = command;
      return true;
    };
  });
  await page.getByTestId("boats-map-copy-link").click();
  expect(
    await page.evaluate(() => (window as unknown as { __fallbackCopyCommand?: string }).__fallbackCopyCommand)
  ).toBe("copy");

  await page.locator(".maplibregl-ctrl-zoom-in").click();
  await page.getByTestId("boats-map-reset-view").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("mapCenter"))
    .toBeNull();
  await page.waitForTimeout(800);
  const resetUrl = new URL(page.url());
  expect(resetUrl.searchParams.get("mapCenter")).toBeNull();
  expect(resetUrl.searchParams.get("mapZoom")).toBeNull();
  expect(resetUrl.searchParams.get("view")).toBe("map");
  expect(resetUrl.searchParams.get("location")).toBe("puerto-rico");
  await expect(page.getByTestId("boats-map-shell")).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });

  const markerRequestsBeforeRecenter = markerRequests.length;
  await page.locator(".maplibregl-ctrl-zoom-in").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("mapZoom"))
    .not.toBeNull();
  await page.getByTestId("boats-map-recenter").click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("mapCenter"))
    .toBeNull();
  await page.waitForTimeout(800);
  const recenteredUrl = new URL(page.url());
  expect(recenteredUrl.searchParams.get("mapCenter")).toBeNull();
  expect(recenteredUrl.searchParams.get("mapZoom")).toBeNull();
  expect(recenteredUrl.searchParams.get("view")).toBe("map");
  expect(recenteredUrl.searchParams.get("location")).toBe("puerto-rico");
  await expect
    .poll(() => markerRequests.length)
    .toBeGreaterThan(markerRequestsBeforeRecenter);
});

test("boats map view handles rate-limited marker responses without crashing", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockMapStyle(page);
  await mockRateLimitedMapMarkersResponse(page);

  await page.goto("/boats?location=puerto-rico");
  await page.getByTestId("boats-view-toggle-map").click();

  await expect(page.getByText("Map requests slowed down", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("boats-map-shell")).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });
});

test("boats map view surfaces style-provider failures", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_MAP_ENABLED !== "true", "requires NEXT_PUBLIC map test env");
  await mockBoatsResponse(page);
  await mockBrokenMapStyle(page);

  await page.goto("/boats?location=puerto-rico");
  await page.getByTestId("boats-view-toggle-map").click();

  await expect(page.getByText("Map style could not load", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("boats-map-shell")).toBeVisible({ timeout: MAP_SHELL_TIMEOUT_MS });
});

test("boats currency selection persists after reload locally", async ({ page }) => {
  await mockBoatsResponse(page);

  await page.goto("/boats");
  const currencySelector = page.locator("#boats-currency:not([disabled])").first();
  await expect(currencySelector).toBeEnabled();
  await currencySelector.selectOption("EUR");
  await expect(currencySelector).toHaveValue("EUR");

  await page.reload();
  const reloadedCurrencySelector = page.locator("#boats-currency:not([disabled])").first();
  await expect(reloadedCurrencySelector).toBeEnabled();
  await expect(reloadedCurrencySelector).toHaveValue("EUR");
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
