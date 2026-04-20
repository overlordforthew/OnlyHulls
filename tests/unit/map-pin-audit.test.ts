import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMapPinAuditWhereSql,
  buildMapPinAuditUrl,
  buildMapPinListingUrl,
  isSafeGeocodeBackupTableName,
  normalizePublicBaseUrl,
  parseMapPinAuditLimit,
  parseMapPinAuditPrecision,
} from "../../src/lib/locations/map-pin-audit";

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
  assert.equal(parseMapPinAuditPrecision("marina"), "marina");
  assert.equal(parseMapPinAuditPrecision("street"), "street");
  assert.equal(parseMapPinAuditPrecision("city"), null);
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

  assert.deepEqual(all.params, [["exact", "street", "marina"]]);
  assert.match(all.whereSql, /b\.location_geocode_precision = ANY\(\$1::text\[\]\)/);
  assert.doesNotMatch(all.whereSql, /location_geocode_precision = \$2/);

  const street = buildMapPinAuditWhereSql({
    precision: "street",
    backupTable: "boat_geocode_backup_20260420123456",
  });

  assert.deepEqual(street.params, [["street"]]);
  assert.match(street.whereSql, /public\.boat_geocode_backup_20260420123456 backup/);
  assert.doesNotMatch(street.whereSql, /location_geocode_precision = \$2/);
  assert.throws(
    () => buildMapPinAuditWhereSql({ precision: null, backupTable: "boat_geocode_backup_latest" }),
    /Invalid --backup-table/
  );
});
