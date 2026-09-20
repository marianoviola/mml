import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFourFiftyScenario } from "./scenario.ts";
import { ContextStore } from "./context.ts";
import { LifecycleOperations } from "./operations.ts";

const fresh = () => mkdtempSync(join(tmpdir(), "mml-"));

test("the €450 scenario runs end to end, deterministically, and every step lands in the customer context", () => {
  const dir = fresh();
  try {
    const first = runFourFiftyScenario({ stateDir: dir, modelVersion: "test" });
    const second = runFourFiftyScenario({ stateDir: fresh(), modelVersion: "test" });
    assert.equal(first.outputHash, second.outputHash, "same fixtures must give the same bundle");

    const nodes = first.steps.map((step) => step.node);
    for (const node of ["requirement", "shortlist", "comparison", "ownership", "repair", "continuation", "sensitivity"]) {
      assert.ok(nodes.includes(node), `missing ${node}`);
    }
    const context = new ContextStore(dir).get("four-fifty");
    assert.ok(context.contract, "a contract was signed");
    assert.ok(context.timeline.length >= 10);
    assert.equal(context.timeline[0].node, "requirement");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the model is honest about the €450 gap and finds what has to give", () => {
  const dir = fresh();
  try {
    const bundle = runFourFiftyScenario({ stateDir: dir, modelVersion: "test" });
    const shortlist = bundle.steps.find((step) => step.node === "shortlist")!.output as { eligible: Array<{ allIn: number; withinBudget: boolean; life: string }> };
    // Every eligible placement is a family-touring estate; the cheapest is a later life, not a new car.
    assert.ok(shortlist.eligible.length >= 3);
    assert.equal(shortlist.eligible[0].life, "third-life");
    assert.ok(shortlist.eligible[0].allIn < shortlist.eligible[shortlist.eligible.length - 1].allIn);

    const answer = bundle.steps.find((step) => step.title.startsWith("The €450 answer"))!.output as {
      withinBudget: boolean; adjustments: Array<{ kind: string; allIn?: number; requiredBudget?: number; annualKm?: number }>;
      gave: string; contractedAnnualKm: number; contractedBudget: number; allInAtDeclaredDistance: number;
    };
    if (!answer.withinBudget) {
      assert.ok(answer.adjustments.length > 0, "an over-budget answer must say what has to change");
      assert.ok(!answer.adjustments.some((adjustment) => adjustment.kind === "none"), "'nothing can be done' is not an answer the model gives");
      const distance = answer.adjustments.find((adjustment) => adjustment.kind === "distance");
      const budget = answer.adjustments.find((adjustment) => adjustment.kind === "budget");
      if (distance) {
        assert.equal(answer.gave, "distance");
        assert.ok(distance.allIn! <= 450 && answer.contractedAnnualKm < 20000);
      } else {
        assert.equal(answer.gave, "budget");
        assert.ok(budget && budget.requiredBudget! > 450, "when no distance fits, the model names the budget that would");
        assert.equal(answer.contractedAnnualKm, 20000);
        assert.equal(answer.contractedBudget, answer.allInAtDeclaredDistance);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("repair events follow the lifecycle standard: state, response, repair before replacement, continuity", () => {
  const dir = fresh();
  try {
    const bundle = runFourFiftyScenario({ stateDir: dir, modelVersion: "test" });
    const repairs = bundle.steps.filter((step) => step.node === "repair").map((step) => step.output as { assessment: { eventId: string; state: string; chosen: string; savingVersusAssembly: { value: number } } });
    const hail = repairs.find((repair) => repair.assessment.eventId === "hail-roof")!;
    assert.equal(hail.assessment.state, "cosmetic");
    assert.equal(hail.assessment.chosen, "modular-repair");
    assert.ok(hail.assessment.savingVersusAssembly.value > 0);
    const lens = repairs.find((repair) => repair.assessment.eventId === "headlamp-lens-stone")!;
    assert.equal(lens.assessment.state, "safety-defect");
    // The Corolla's lamp is a sealed assembly: the conventional design forces the whole unit (chapter 3.6).
    assert.equal(lens.assessment.chosen, "assembly-replacement");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("continuation is decided on the fleet's money and reports both questions", () => {
  const dir = fresh();
  try {
    const bundle = runFourFiftyScenario({ stateDir: dir, modelVersion: "test" });
    const continuation = bundle.steps.find((step) => step.node === "continuation")!.output as {
      decision: string; asset: { remainsMobilityAsset: boolean }; placement: { continueCost: { value: number }; reassignCost: { value: number } };
    };
    assert.equal(continuation.asset.remainsMobilityAsset, true);
    assert.equal(continuation.decision, "continue");
    assert.ok(continuation.placement.continueCost.value < continuation.placement.reassignCost.value);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("operations refuse to run out of order and validate ids", () => {
  const dir = fresh();
  try {
    const ops = new LifecycleOperations(new ContextStore(dir));
    assert.throws(() => ops.shortlist("nobody"), /unknown customer/);
    ops.captureHousehold("c1", { adults: 1, children: 0, longJourneys: false, annualKm: 8000, monthlyBudget: 300, homeCharging: false, publicChargingAccess: true, licenceYears: 2, compactPreferred: true });
    assert.throws(() => ops.advance("c1", 6), /no active contract/);
    assert.throws(() => ops.quote("c1", "no-such-offer"), /unknown offer/);
    assert.throws(() => new ContextStore(dir).get("../etc/passwd"), RangeError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the bundle says what its answer rests on: the sensitivity step ranks inputs and lists what does not matter", () => {
  const dir = fresh();
  try {
    const bundle = runFourFiftyScenario({ stateDir: dir, modelVersion: "test" });
    const answer = bundle.steps.find((step) => step.title.startsWith("The €450 answer"))!.output as { contractedAnnualKm: number; adjustments: Array<{ kind: string; allIn?: number }>; allInAtDeclaredDistance: number };
    const sensitivity = bundle.steps.find((step) => step.node === "sensitivity")!.output as {
      baseline: { mml: number; ownership: number; longTermRental: number };
      leading: string[];
      rows: Array<{ path: string; kind: string; mml: number; ownership: number; longTermRental: number }>;
      inert: string[];
    };
    const contracted = answer.adjustments.find((adjustment) => adjustment.kind === "distance")?.allIn ?? answer.allInAtDeclaredDistance;
    assert.equal(sensitivity.baseline.mml, contracted, "sensitivity is run on the contracted placement at the contracted distance");
    assert.ok(sensitivity.leading.includes("vehicle.listPrice"));
    assert.ok(sensitivity.leading.includes("curves.curves.hev"), "the residual curve is now a provenanced input and shows its weight");
    assert.ok(sensitivity.leading.includes("vehicle.lifecycle.structuralLifeYears"));
    assert.ok(sensitivity.rows.every((row) => row.mml !== 0 || row.ownership !== 0 || row.longTermRental !== 0));
    assert.ok(sensitivity.inert.includes("finance.reassignmentCost"), "a quote does not depend on reassignment cost, and the bundle says so");
    const structural = sensitivity.rows.find((row) => row.path === "vehicle.lifecycle.structuralLifeYears")!;
    assert.ok(structural.mml < 0 && structural.ownership === 0, "structural life is MML's own lever; ownership does not see it");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the scenario runs under each assumption set, records which one, and the sets order the answer as they should", () => {
  const dirs = [fresh(), fresh(), fresh()];
  try {
    const [adverse, central, optimistic] = (["adverse", "central", "optimistic"] as const).map((assumptionSet, index) =>
      runFourFiftyScenario({ stateDir: dirs[index], modelVersion: "test", assumptionSet }),
    );
    assert.equal(central.assumptionSet.id, "central");
    assert.notEqual(adverse.outputHash, central.outputHash);
    const answerOf = (bundle: typeof central) => (bundle.steps.find((step) => step.title.startsWith("The €450 answer"))!.output as { allInAtDeclaredDistance: number }).allInAtDeclaredDistance;
    assert.ok(answerOf(adverse) > answerOf(central) && answerOf(central) > answerOf(optimistic), "adverse dearer than central, central dearer than optimistic");
    const breakEvens = central.steps.filter((step) => step.node === "break-even");
    assert.equal(breakEvens.length, 2, "break-even on the contracted placement and on the new vehicle");
    for (const step of breakEvens) {
      const rows = (step.output as { rows: Array<{ input: string; value?: number; note: string }> }).rows;
      assert.deepEqual(rows.map((row) => row.input.split(".").at(-1)), ["annualKm", "structuralLifeYears", "fleetCostOfCapital", step.title.includes("new") ? "firstLifeConsumptionFactor" : "laterLifeConsumptionFactor"]);
      for (const row of rows) assert.ok(row.note.length > 0);
    }
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
