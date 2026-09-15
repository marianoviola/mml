import { test } from "node:test";
import assert from "node:assert/strict";
import { listAssumptions, loadFixtures } from "./index.ts";

test("fixtures load, reference each other consistently and are hashed", () => {
  const fixtures = loadFixtures();
  const vehicleIds = new Set(fixtures.vehicles.map((vehicle) => vehicle.id));
  for (const offer of fixtures.offers) assert.ok(vehicleIds.has(offer.vehicleId), `offer ${offer.id} references ${offer.vehicleId}`);
  for (const curve of Object.values(fixtures.curves.curves)) assert.equal(curve.length, 16);
  assert.equal(Object.keys(fixtures.hashes).length, 6);
});

test("every number the model consumes declares evidence, assumption or derived", () => {
  const records = listAssumptions();
  assert.ok(records.length > 60);
  for (const record of records) {
    assert.ok(["evidence", "assumption", "derived"].includes(record.kind), record.path);
    if (record.kind === "evidence") assert.ok(record.source, `${record.path} claims evidence without a source`);
    if (record.kind === "assumption") assert.ok(record.rationale, `${record.path} is an assumption without a rationale`);
  }
});
