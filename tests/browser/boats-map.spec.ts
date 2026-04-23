import { expect, test, type Page } from "@playwright/test";

type MapRequest = {
  bbox: { west: number; south: number; east: number; north: number };
  params: URLSearchParams;
  url: string;
};

type ParsedBbox = { west: number; south: number; east: number; north: number };

function parseMapRequest(url: string): MapRequest | null {
  const u = new URL(url);
  const bboxStr = u.searchParams.get("bbox");
  if (!bboxStr) return null;
  const parts = bboxStr.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  return { bbox: { west, south, east, north }, params: u.searchParams, url };
}

function bboxCenter(bbox: ParsedBbox) {
  return { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 };
}

// Map shell only renders when boats.length > 0 in the underlying grid fetch,
// so seed /api/boats with a single stub so the view-mode switch can reach the
// map component.
const STUB_BOAT = {
  id: "stub-map-1",
  make: "Stub",
  model: "Test",
  year: 2020,
  asking_price: 100000,
  currency: "USD",
  asking_price_usd: 100000,
  location_text: "Stub Harbor",
  slug: "stub-map-1",
  is_sample: false,
  hero_url: null,
  specs: { loa: 40, rig_type: "catamaran", vessel_type: "catamaran" },
  character_tags: [] as string[],
  source_site: "onlyhulls",
  source_name: "OnlyHulls",
  source_url: "https://onlyhulls.com/boats/stub-map-1",
};

async function stubMapApi(page: Page) {
  await page.route("**/api/boats/map**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boats: [], hasMore: false }),
    });
  });
  await page.route("**/api/boats?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ boats: [STUB_BOAT], total: 1 }),
    });
  });
}

async function instrumentGeolocation(page: Page, fakePosition: { lat: number; lng: number } | null) {
  await page.addInitScript(
    (payload: { fake: { lat: number; lng: number } | null }) => {
      (window as unknown as { __geolocationCalls: number }).__geolocationCalls = 0;
      const original = navigator.geolocation;
      const instrumented: Geolocation = {
        getCurrentPosition(success, errorCb) {
          (window as unknown as { __geolocationCalls: number }).__geolocationCalls += 1;
          if (payload.fake) {
            const position = {
              coords: {
                latitude: payload.fake.lat,
                longitude: payload.fake.lng,
                accuracy: 50,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
                toJSON() {
                  return this;
                },
              },
              timestamp: Date.now(),
              toJSON() {
                return this;
              },
            } as unknown as GeolocationPosition;
            setTimeout(() => success(position), 10);
          } else if (errorCb) {
            setTimeout(
              () =>
                errorCb({
                  code: 1,
                  message: "denied",
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                } as GeolocationPositionError),
              10
            );
          }
        },
        watchPosition: original?.watchPosition?.bind(original) ?? (() => 0),
        clearWatch: original?.clearWatch?.bind(original) ?? (() => undefined),
      };
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: instrumented,
      });
    },
    { fake: fakePosition }
  );
}

function collectMapRequests(page: Page) {
  const requests: MapRequest[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes("/api/boats/map")) return;
    const parsed = parseMapRequest(url);
    if (parsed) requests.push(parsed);
  });
  return requests;
}

async function waitForMapShell(page: Page) {
  await expect(page.getByTestId("boats-map-shell")).toBeVisible({ timeout: 20_000 });
}

async function readGeoCallCount(page: Page) {
  return page.evaluate(() => (window as unknown as { __geolocationCalls: number }).__geolocationCalls || 0);
}

test.describe("BoatsMapView initial open", () => {
  // Each test mounts a headless MapLibre canvas. Running them in parallel
  // contends on the shared software-WebGL context in CI, which flakes the
  // moveend-driven GPS refetch. Keep this suite serial.
  test.describe.configure({ mode: "serial" });

  test("flow 1: search with location pins the map to that market and skips geolocation", async ({ page }) => {
    await instrumentGeolocation(page, { lat: 39.74, lng: -104.99 });
    await stubMapApi(page);
    const requests = collectMapRequests(page);

    await page.goto("/boats?view=map&location=florida");
    await waitForMapShell(page);
    await expect
      .poll(() => requests.length, { timeout: 15_000, message: "expected at least one map API request" })
      .toBeGreaterThan(0);
    await page.waitForTimeout(700);

    expect(await readGeoCallCount(page)).toBe(0);

    const firstCenter = bboxCenter(requests[0].bbox);
    expect(firstCenter.lat).toBeGreaterThan(23);
    expect(firstCenter.lat).toBeLessThan(32);
    expect(firstCenter.lng).toBeGreaterThan(-87);
    expect(firstCenter.lng).toBeLessThan(-79);

    for (const request of requests) {
      expect(request.params.get("location")).toBe("florida");
    }
  });

  test("flow 2: search with filters but no location keeps the default viewport (no GPS override)", async ({ page }) => {
    // Any active filter (hullType, query, tag, price...) counts as search
    // scope, so the map should stay at its global default instead of flying
    // to the user's GPS — otherwise users outside a boating region would see
    // an empty map even though matching catamarans exist elsewhere.
    const denver = { lat: 39.7392, lng: -104.9903 };
    await instrumentGeolocation(page, denver);
    await stubMapApi(page);
    const requests = collectMapRequests(page);

    await page.goto("/catamarans-for-sale?view=map");
    await waitForMapShell(page);

    await expect
      .poll(() => requests.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    // Give any latent geolocation call and debounced refetches time to fire.
    await page.waitForTimeout(1500);

    expect(await readGeoCallCount(page)).toBe(0);

    // Final request should still be centered near the Caribbean default
    // viewport (20.5, -69.5), not Denver.
    const lastRequest = requests[requests.length - 1];
    const center = bboxCenter(lastRequest.bbox);
    expect(Math.abs(center.lat - 20.5)).toBeLessThan(4);
    expect(Math.abs(center.lng - -69.5)).toBeLessThan(4);
    expect(lastRequest.params.get("hullType")).toBe("catamaran");
    expect(lastRequest.params.get("location")).toBeNull();
  });

  test("flow 3: no search opens at GPS and filters carry through", async ({ page }) => {
    // Pick a GPS position deliberately far from the Caribbean default viewport
    // (20.5, -69.5) so a "moved toward GPS" assertion is unambiguous even with
    // wide zoom-5 bboxes.
    const sydney = { lat: -33.87, lng: 151.21 };
    await instrumentGeolocation(page, sydney);
    await stubMapApi(page);
    const requests = collectMapRequests(page);

    await page.goto("/boats?view=map");
    await waitForMapShell(page);

    await expect
      .poll(async () => readGeoCallCount(page), { timeout: 10_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(
        () => {
          const last = requests[requests.length - 1];
          if (!last) return null;
          const center = bboxCenter(last.bbox);
          return Math.abs(center.lat - sydney.lat) < 3 && Math.abs(center.lng - sydney.lng) < 3;
        },
        {
          timeout: 15_000,
          message: "expected last map fetch to center near the Sydney GPS position",
        }
      )
      .toBe(true);
  });

  test("shared-link viewport is honored and skips geolocation", async ({ page }) => {
    await instrumentGeolocation(page, { lat: 39.74, lng: -104.99 });
    await stubMapApi(page);
    const requests = collectMapRequests(page);

    // parseMapViewportFromParams reads mapCenter=lat,lng and mapZoom
    await page.goto("/boats?view=map&mapCenter=41.38,2.18&mapZoom=7");
    await waitForMapShell(page);
    await expect
      .poll(() => requests.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(700);

    expect(await readGeoCallCount(page)).toBe(0);
    const firstCenter = bboxCenter(requests[0].bbox);
    // Barcelona-ish (41.38, 2.18)
    expect(Math.abs(firstCenter.lat - 41.38)).toBeLessThan(2);
    expect(Math.abs(firstCenter.lng - 2.18)).toBeLessThan(3);
  });
});
