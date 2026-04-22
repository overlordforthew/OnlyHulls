import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMapPinAuditAttestation,
  buildMapPinAuditSampleHash,
  buildMapPinAuditWhereSql,
  buildMapPinAuditUrl,
  buildMapPinListingUrl,
  isSafeGeocodeBackupTableName,
  normalizePublicBaseUrl,
  parseMapPinAuditLimit,
  parseMapPinAuditPrecision,
  type MapPinAuditReport,
} from "../../src/lib/locations/map-pin-audit";

const auditReport: MapPinAuditReport = {
  generatedAt: "2026-04-20T00:00:00.000Z",
  seed: "launch-review",
  limit: 25,
  eligibleCount: 100,
  returnedCount: 2,
  precision: "all",
  backupTable: null,
  pins: [
    {
      slug: "2015-lagoon-450-penangmalaysia",
      title: "2015 Lagoon 450",
      locationText: "Penang, Malaysia",
      latitude: 5.4141,
      longitude: 100.3288,
      precision: "city",
      provider: "opencage",
      score: 0.92,
      geocodedAt: "2026-04-20T00:00:00.000Z",
      placeName: "Penang, Malaysia",
      auditUrl: "https://www.openstreetmap.org/?mlat=5.4141&mlon=100.3288#map=14/5.4141/100.3288",
      listingUrl: "https://onlyhulls.com/boats/2015-lagoon-450-penangmalaysia",
    },
    {
      slug: "2006-sunreef-catamaran-flybridge-bali",
      title: "2006 Sunreef Catamaran Flybridge",
      locationText: "Bali, Indonesia",
      latitude: -8.3405,
      longitude: 115.092,
      precision: "city",
      provider: "opencage",
      score: 0.88,
      geocodedAt: "2026-04-20T00:00:00.000Z",
      placeName: "Bali, Indonesia",
      auditUrl: "https://www.openstreetmap.org/?mlat=-8.3405&mlon=115.092#map=14/-8.3405/115.092",
      listingUrl: "https://onlyhulls.com/boats/2006-sunreef-catamaran-flybridge-bali",
    },
  ],
};

test("map pin audit validates backup table names strictly", () => {
  assert.equal(isSafeGeocodeBackupTableName("boat_geocode_backup_20260420123456"), true);
  assert.equal(isSafeGeocodeBackupTableName("boat_geocode_backup_2026042012345"), false);
  assert.equal(isSafeGeocodeBackupTableName("boat_geocode_backup_202604201234567"), false);
  assert.equal(isSafeGeocodeBackupTableName("boats;DROP TABLE boats"), false);
  assert.equal(isSafeGeocodeBackupTableName("boat_geocode_backup_latest"), false);
});

test("map pin audit parses bounded limits and public precisions", () => {
  assert.equal(parseMapPinAuditLimit("10"), 10);
  assert.equal(parseMapPinAuditLimit("9999"), 200);
  assert.equal(parseMapPinAuditLimit("-1"), 25);
  assert.equal(parseMapPinAuditPrecision("city"), "city");
  assert.equal(parseMapPinAuditPrecision("marina"), null);
  assert.equal(parseMapPinAuditPrecision("street"), null);
  assert.equal(parseMapPinAuditPrecision("region"), null);
  assert.equal(parseMapPinAuditPrecision("country"), null);
  assert.equal(parseMapPinAuditPrecision(""), null);
});

test("map pin audit builds safe audit and listing URLs", () => {
  assert.equal(
    buildMapPinAuditUrl(18.3358, -65.6319),
    "https://www.openstreetmap.org/?mlat=18.3358&mlon=-65.6319#map=14/18.3358/-65.6319"
  );
  assert.equal(buildMapPinAuditUrl(Number.NaN, -65.6319), null);
  assert.equal(normalizePublicBaseUrl("https://onlyhulls.com/"), "https://onlyhulls.com");
  assert.equal(normalizePublicBaseUrl("https://www.onlyhulls.com/search?x=1#boats"), "https://www.onlyhulls.com");
  assert.equal(normalizePublicBaseUrl("http://localhost:3000/dev?x=1"), "http://localhost:3000");
  assert.equal(normalizePublicBaseUrl("javascript:alert(1)"), "https://onlyhulls.com");
  assert.equal(normalizePublicBaseUrl("https://example.com"), "https://onlyhulls.com");
  assert.equal(
    buildMapPinListingUrl("https://onlyhulls.com", "2018-lagoon 450"),
    "https://onlyhulls.com/boats/2018-lagoon%20450"
  );
});

test("map pin audit builds scoped public-coordinate SQL", () => {
  const all = buildMapPinAuditWhereSql({ precision: null, backupTable: null });

  assert.deepEqual(all.params, [["city"]]);
  assert.match(all.whereSql, /b\.location_geocode_precision = ANY\(\$1::text\[\]\)/);
  assert.doesNotMatch(all.whereSql, /location_geocode_precision = \$2/);

  const city = buildMapPinAuditWhereSql({
    precision: "city",
    backupTable: "boat_geocode_backup_20260420123456",
  });

  assert.deepEqual(city.params, [["city"]]);
  assert.match(city.whereSql, /public\.boat_geocode_backup_20260420123456 backup/);
  assert.doesNotMatch(city.whereSql, /location_geocode_precision = \$2/);
  assert.throws(
    () => buildMapPinAuditWhereSql({ precision: null, backupTable: "boat_geocode_backup_latest" }),
    /Invalid --backup-table/
  );
});

test("map pin audit attestation is stable and redacted", () => {
  const sampleHash = buildMapPinAuditSampleHash(auditReport);
  const attestation = buildMapPinAuditAttestation(auditReport, {
    acceptedCount: 2,
    rejectedCount: 0,
    reviewedAt: "2026-04-20T01:00:00.000Z",
    reviewedBy: "ops",
  });
  const serialized = JSON.stringify(attestation);

  assert.equal(attestation.schemaVersion, 1);
  assert.equal(attestation.sampleHash, sampleHash);
  assert.equal(buildMapPinAuditSampleHash(auditReport), sampleHash);
  assert.equal(attestation.sampleLimit, 25);
  assert.equal(attestation.sampleSize, 2);
  assert.equal(attestation.reviewedBy, "ops");
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("2015-lagoon-450"), false);
  assert.throws(
    () =>
      buildMapPinAuditAttestation(auditReport, {
        acceptedCount: 1,
        rejectedCount: 0,
        reviewedBy: "ops",
      }),
    /Accepted plus rejected/
  );
  assert.throws(
    () =>
      buildMapPinAuditAttestation(auditReport, {
        acceptedCount: 2,
        rejectedCount: 0,
        reviewedBy: "ops",
        notes: "x".repeat(501),
      }),
    /--notes/
  );
});
