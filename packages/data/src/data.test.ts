import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAssumptionSet, listAssumptionSets, listAssumptions, loadAssumptionSet, loadFixtures } from "./index.ts";

test("fixtures load, reference each other consistently and are hashed", () => {
  const fixtures = loadFixtures();
  const vehicleIds = new Set(fixtures.vehicles.map((vehicle) => vehicle.id));
  for (const offer of fixtures.offers) assert.ok(vehicleIds.has(offer.vehicleId), `offer ${offer.id} references ${offer.vehicleId}`);
  for (const curve of Object.values(fixtures.curves.curves)) assert.equal(curve.values.length, 16);
  assert.equal(Object.keys(fixtures.hashes).length, 7);
});

test("every number the model consumes declares evidence, assumption or derived", () => {
  const records = listAssumptions();
  assert.ok(records.length > 60);
  const curve = records.find((record) => record.path === "curves.curves.hev");
  assert.ok(curve && Array.isArray(curve.value) && curve.value.length === 16, "a residual curve is listed with one status for the whole series");
  for (const record of records) {
    assert.ok(["evidence", "assumption", "derived"].includes(record.kind), record.path);
    if (record.kind === "evidence") assert.ok(record.source, `${record.path} claims evidence without a source`);
    if (record.kind === "assumption") assert.ok(record.rationale, `${record.path} is an assumption without a rationale`);
  }
});

test("assumption sets override by path, turn overridden evidence into assumption, and leave the central fixtures untouched", () => {
  assert.deepEqual(listAssumptionSets(), ["adverse", "central", "optimistic"]);
  const base = loadFixtures();
  const adverse = applyAssumptionSet(base, loadAssumptionSet("adverse"));
  assert.equal(adverse.assumptionSet.id, "adverse");
  assert.match(adverse.assumptionSet.hash, /^[0-9a-f]{12}$/);
  const corolla = adverse.vehicles.find((vehicle) => vehicle.id === "toyota-corolla-ts-hybrid")!;
  assert.equal(corolla.lifecycle.structuralLifeYears.value, 12);
  assert.equal(adverse.energy.petrolPerLitre.kind, "assumption", "evidence overridden is no longer evidence");
  assert.equal(base.energy.petrolPerLitre.kind, "evidence");
  assert.equal(base.vehicles.find((vehicle) => vehicle.id === "toyota-corolla-ts-hybrid")!.lifecycle.structuralLifeYears.value, 15);
  const central = applyAssumptionSet(base, loadAssumptionSet("central"));
  assert.equal(central.energy.petrolPerLitre.kind, "evidence", "the central set changes nothing");
  assert.throws(() => applyAssumptionSet(base, { id: "x", description: "", overrides: { "finance.nope": { value: 1, rationale: "" } } }));
  assert.throws(() => applyAssumptionSet(base, { id: "x", description: "", overrides: { "vehicles.ghost.listPrice": { value: 1, rationale: "" } } }));
});

test("the evidence the €450 answer rests on carries its source", () => {
  const records = listAssumptions();
  const evidence = records.filter((record) => record.kind === "evidence");
  assert.ok(evidence.length >= 8, `expected the documented evidence, found ${evidence.length}`);
  for (const path of ["vehicles.2.listPrice", "energy.petrolPerLitre", "insurance.rcPremiumPerYear", "finance.loanApr"]) {
    const record = records.find((candidate) => candidate.path === path);
    assert.ok(record && record.kind === "evidence" && record.source, `${path} should be evidence with a source`);
  }
  const hev = records.find((record) => record.path === "curves.curves.hev");
  assert.ok(hev && hev.source, "the observed residual curve names where its points come from");
});
