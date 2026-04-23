import { expect, test } from "@playwright/test";

// Today's SEO audit surfaced that /catamarans-for-sale and /sailboats-for-sale
// lost server-rendered inventory when they switched to embedding the
// client-side BoatBrowse component (commit 2703b3c). Crawlers ended up with
// hub pages whose initial HTML had zero boat cards. These specs pin the fix:
// the raw HTML from the server response must already contain boat cards, not
// an empty shimmer, before any client JS runs.

const hubs = [
  { path: "/catamarans-for-sale", heading: "Catamarans for Sale" },
  { path: "/sailboats-for-sale", heading: "Sailboats for Sale" },
  { path: "/boats/location/florida", heading: "Boats for Sale in Florida" },
  { path: "/boats/make/lagoon", heading: "Lagoon Boats for Sale" },
];

for (const hub of hubs) {
  test(`hub SSR: ${hub.path} delivers boat inventory in initial HTML`, async ({
    request,
  }) => {
    const response = await request.get(hub.path);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();

    expect(html).toContain(hub.heading);

    // `card-hover` is on every grid BoatCard; location hubs render BoatCards
    // directly and category hubs now seed BoatBrowse so the same class
    // appears in SSR. If we ever revert to a client-only fetch this
    // assertion fails loudly.
    const cardMatches = html.match(/class="[^"]*card-hover[^"]*"/g) ?? [];
    expect(cardMatches.length).toBeGreaterThan(0);
  });
}
