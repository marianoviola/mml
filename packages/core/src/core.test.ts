import { test } from "node:test";
import assert from "node:assert/strict";
import { annuityPayment, discountedCashFlow } from "./dcf.ts";
import { assessVehicleFit, deriveMobilityRequirement } from "./mobility-class.ts";
import { assessRepair } from "./condition.ts";
import { assessContinuation } from "./continuation.ts";
import { assumption, type ProvenancedSeries } from "./provenance.ts";
import { oneAtATimeSensitivity, provenancedPaths } from "./sensitivity.ts";
import type { Household, RepairEventType, Vehicle, ResidualCurves } from "./types.ts";
import { estimateRetention } from "./retention.ts";

const household: Household = {
  adults: 2, children: 2, longJourneys: true, annualKm: 20000, monthlyBudget: 450,
  homeCharging: false, publicChargingAccess: true, licenceYears: 15,
};

const vehicle: Vehicle = {
  id: "v", make: "Test", model: "Estate", mobilityClass: "family-touring", powertrain: "hev", seats: 5, luggageLitres: 600,
  listPrice: assumption(30000, "test"),
  energyCostPerKm: { home: assumption(0.08, "t"), public: assumption(0.08, "t") },
  maintenancePerYear: assumption(450, "t"), insuranceGroup: 18, kerbMassKg: assumption(1400, "t"), residualCurve: "hev",
  lifecycle: {
    stage: "mml-compatible", structuralLifeYears: assumption(15, "t"), softwareSupportHorizonYears: assumption(10, "t"),
    partsAvailability: "high", modularLighting: false, refurbishmentYears: [5, 10], refurbishmentCost: assumption(2500, "t"),
  },
};

const series = (values: number[]): ProvenancedSeries => ({ values, kind: "assumption", rationale: "t" });
const curves: ResidualCurves = {
  curves: { ice: series([1, 0.7, 0.5]), hev: series([1, 0.8, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2]), bev: series([1, 0.7, 0.5]) },
  referenceAnnualKm: assumption(15000, "t"), kmAdjustmentPer5000: assumption(0.02, "t"),
  componentRetention: series([0.4, 0.38, 0.36, 0.34, 0.32, 0.3, 0.28, 0.26, 0.24, 0.22]),
  materialValuePerKg: assumption(0.85, "t"),
  materialCapitalFloorShare: assumption(0.9, "t"),
  conditionAdjustment: { excellent: assumption(1.05, "t"), good: assumption(1, "t"), fair: assumption(0.9, "t"), poor: assumption(0.75, "t") },
};

test("DCF discounts each year and sums to NPV", () => {
  const result = discountedCashFlow({ discountRate: 0.1, cashFlows: [{ year: 0, amount: -100 }, { year: 1, amount: 110 }] });
  assert.ok(Math.abs(result.netPresentValue) < 1e-9);
  assert.throws(() => discountedCashFlow({ discountRate: -1, cashFlows: [] }), RangeError);
});

test("annuity payment matches the zero-rate and standard cases", () => {
  assert.equal(annuityPayment(1200, 0, 12), 100);
  assert.equal(Math.round(annuityPayment(10000, 0.06, 60) * 100) / 100, 193.33);
});

test("the €450 household is family-touring on a 60-month term", () => {
  const requirement = deriveMobilityRequirement(household);
  assert.equal(requirement.mobilityClass, "family-touring");
  assert.equal(requirement.termMonths, 60);
  assert.equal(requirement.minLuggageLitres, 500);
});

test("home charging moves the same family to family-electric; a couple in the city is urban-compact", () => {
  assert.equal(deriveMobilityRequirement({ ...household, homeCharging: true }).mobilityClass, "family-electric");
  assert.equal(
    deriveMobilityRequirement({ ...household, adults: 2, children: 0, longJourneys: false, annualKm: 8000, compactPreferred: true }).mobilityClass,
    "urban-compact",
  );
});

test("fit assessment rejects capacity and charging mismatches and explains why", () => {
  const requirement = deriveMobilityRequirement(household);
  const small = { ...vehicle, luggageLitres: 300 };
  const fit = assessVehicleFit(small, requirement, household);
  assert.equal(fit.fits, false);
  assert.match(fit.reasons[0], /luggage/);
  assert.equal(assessVehicleFit(vehicle, requirement, household).fits, true);
});

test("retention values follow the chapter 4 hierarchy", () => {
  const retention = estimateRetention(vehicle, curves, 5, 100000, "good");
  assert.ok(retention.mobilityValue.value > retention.componentRetentionValue.value);
  assert.ok(retention.componentRetentionValue.value > retention.materialRetentionValue.value);
  assert.equal(retention.materialRetentionValue.value, 1190);
  // Above-reference distance reduces mobility value, never below the 0.6 floor.
  assert.ok(estimateRetention(vehicle, curves, 5, 200000, "good").mobilityValue.value < retention.mobilityValue.value);
});

const lens: RepairEventType = {
  id: "lens", label: "lens", state: "safety-defect",
  assemblyReplacementCost: assumption(1100, "t"), modularRepairCost: assumption(180, "t"), requiresModularLighting: true,
  downtimeDaysAssembly: 1, downtimeDaysModular: 0, driveable: true,
};

test("a sealed lamp forces assembly replacement; a modular lamp allows the lens repair", () => {
  const sealed = assessRepair(vehicle, lens);
  assert.equal(sealed.chosen, "assembly-replacement");
  assert.equal(sealed.response, "intervene");
  const modular = assessRepair({ ...vehicle, lifecycle: { ...vehicle.lifecycle, modularLighting: true } }, lens);
  assert.equal(modular.chosen, "modular-repair");
  assert.equal(modular.savingVersusAssembly.value, 920);
});

test("cosmetic events are accepted or locally repaired, never treated as defects", () => {
  const hail: RepairEventType = {
    id: "hail", label: "hail", state: "cosmetic", assemblyReplacementCost: assumption(2800, "t"),
    modularRepairCost: assumption(600, "t"), downtimeDaysAssembly: 5, downtimeDaysModular: 1, driveable: true,
  };
  assert.equal(assessRepair(vehicle, hail).response, "local-repair");
  assert.equal(assessRepair(vehicle, { ...hail, modularRepairCost: undefined }).response, "accept");
});

test("continuation retires a vehicle worth more as components than repaired", () => {
  const retention = estimateRetention(vehicle, curves, 9, 200000, "poor");
  const result = assessContinuation({
    vehicle, retention, pendingRepairCost: 3000, horizonMonths: 36,
    currentMonthlyFixed: 300, alternativeMonthlyFixed: 320, reassignmentCost: 300,
  });
  assert.equal(result.asset.remainsMobilityAsset, false);
  assert.equal(result.decision, "retire-and-harvest");
});

test("continuation moves the customer when another placement is cheaper for the fleet", () => {
  const retention = estimateRetention(vehicle, curves, 4, 60000, "good");
  const result = assessContinuation({
    vehicle, retention, pendingRepairCost: 500, horizonMonths: 36,
    currentMonthlyFixed: 400, alternativeMonthlyFixed: 300, reassignmentCost: 300,
  });
  assert.equal(result.decision, "reassign-customer");
  assert.equal(
    assessContinuation({ vehicle, retention, pendingRepairCost: 500, horizonMonths: 36, currentMonthlyFixed: 300, alternativeMonthlyFixed: 400, reassignmentCost: 300 }).decision,
    "continue",
  );
});

test("one-at-a-time sensitivity shocks every provenanced value and series, ranks by weight and reports inert inputs", () => {
  const inputs = { curves, price: assumption(100, "t"), _ignored: assumption(5, "t") };
  const result = oneAtATimeSensitivity(inputs, (shocked) => ({
    cost: shocked.price.value * shocked.curves.curves.hev.values[1],
    floor: shocked.curves.materialCapitalFloorShare.value * 10,
  }));
  assert.equal(result.shock, 0.1);
  assert.equal(result.baseline.cost, 80);
  const byPath = Object.fromEntries(result.rows.map((row) => [row.path, row]));
  assert.equal(byPath["price"].deltas.cost, 8);
  assert.equal(byPath["curves.curves.hev"].deltas.cost, 8);
  assert.equal(byPath["curves.materialCapitalFloorShare"].deltas.floor, 0.9);
  assert.equal(byPath["curves.curves.ice"].weight, 0, "an input the outputs do not read is reported inert, not omitted");
  assert.ok(!("_ignored" in byPath), "underscore keys are notes, not inputs");
  assert.ok(result.rows[0].weight >= result.rows.at(-1)!.weight);
  assert.deepEqual(provenancedPaths({ a: { b: assumption(1, "t") } }).map((target) => target.path), ["a.b"]);
  assert.throws(() => oneAtATimeSensitivity(inputs, () => ({ x: 1 }), { shock: -1 }), RangeError);
});
