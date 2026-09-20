import { createHash } from "node:crypto";
import type { Household } from "@mml/core";
import { ContextStore } from "./context.ts";
import { LifecycleOperations } from "./operations.ts";

export interface ScenarioStep {
  node: string;
  title: string;
  output: unknown;
}

export interface ScenarioBundle {
  scenario: "four-fifty";
  modelVersion: string;
  generatedAt: string;
  fixtureHashes: Record<string, string>;
  household: Household;
  steps: ScenarioStep[];
  outputHash: string;
}

/** Part 1's household: two adults, two children, regular long journeys, no home charging, €450 all-in. */
export const FOUR_FIFTY_HOUSEHOLD: Household = {
  adults: 2,
  children: 2,
  longJourneys: true,
  annualKm: 20000,
  monthlyBudget: 450,
  homeCharging: false,
  publicChargingAccess: true,
  licenceYears: 15,
};

/**
 * The €450 question, run end to end without a language model. This is the
 * validation the working note asks for: the same operations an orchestrating
 * agent calls, in the order a household would meet them, with every number
 * traceable to a fixture and every step written to the customer context.
 */
export function runFourFiftyScenario(options: {
  stateDir: string;
  customerId?: string;
  modelVersion: string;
  now?: () => Date;
}): ScenarioBundle {
  const now = options.now ?? (() => new Date("2026-09-15T09:00:00Z"));
  const customerId = options.customerId ?? "four-fifty";
  const store = new ContextStore(options.stateDir, now);
  const ops = new LifecycleOperations(store);
  const steps: ScenarioStep[] = [];

  // 1. Discovery → requirement. The household states the outcome it needs and the budget it declares before quotation.
  const captured = ops.captureHousehold(customerId, FOUR_FIFTY_HOUSEHOLD);
  steps.push({ node: "requirement", title: "What can my family have for €450 per month, everything included?", output: captured.requirement });

  // 2. Shortlist: every eligible vehicle in every life the fleet can place it in, priced as a Mobility Rate.
  const shortlist = ops.shortlist(customerId);
  steps.push({
    node: "shortlist",
    title: "Eligible placements, cheapest first",
    output: {
      eligible: shortlist.eligible.map((quote) => ({
        offer: quote.offer.id,
        vehicle: `${quote.vehicle.make} ${quote.vehicle.model}`,
        life: quote.offer.condition,
        fixedRate: quote.rate.fixedRate.value,
        variableUse: quote.rate.variableUse.value,
        allIn: quote.rate.allInMonthly.value,
        withinBudget: quote.withinBudget,
      })),
      excluded: shortlist.excluded.map(({ vehicle, reasons }) => ({ vehicle: vehicle.id, reasons })),
    },
  });

  // 3. Comparison on the new Corolla: what ownership, rental and MML each charge for.
  const newCorolla = ops.quote(customerId, "off-corolla-new-mi");
  steps.push({
    node: "comparison",
    title: "New Corolla Touring Sports: ownership vs long-term rental vs MML",
    output: {
      modes: newCorolla.comparison.modes.map((mode) => ({ mode: mode.mode, fixed: mode.fixed.value, variable: mode.variableUse.value, allIn: mode.monthlyEquivalent.value, breakdown: mode.breakdown })),
      withinBudget: newCorolla.quote.withinBudget,
      adjustments: newCorolla.adjustments,
    },
  });

  // 4. The €450 answer as the model sees it today: the cheapest family-touring placement, and what has to give if it is over budget.
  const cheapestTouring = shortlist.eligible.find((quote) => quote.vehicle.mobilityClass === "family-touring");
  if (!cheapestTouring) throw new Error("scenario invariant broken: no family-touring placement exists in the fixtures");
  const chosenQuote = ops.quote(customerId, cheapestTouring.offer.id);
  const distanceAdjustment = chosenQuote.adjustments.find((adjustment) => adjustment.kind === "distance");
  const contractKm = chosenQuote.quote.withinBudget
    ? FOUR_FIFTY_HOUSEHOLD.annualKm
    : distanceAdjustment?.kind === "distance" ? distanceAdjustment.annualKm : FOUR_FIFTY_HOUSEHOLD.annualKm;
  const chosen = cheapestTouring;
  steps.push({
    node: "comparison",
    title: `The €450 answer today: ${chosen.vehicle.make} ${chosen.vehicle.model}, ${chosen.offer.condition}`,
    output: {
      allInAtDeclaredDistance: chosenQuote.quote.rate.allInMonthly.value,
      withinBudget: chosenQuote.quote.withinBudget,
      adjustments: chosenQuote.adjustments,
      contractedAnnualKm: contractKm,
      rate: chosenQuote.quote.rate,
    },
  });

  // 5. Contract, then ownership: 18 months pass.
  ops.contract(customerId, chosen.offer.id, now().toISOString().slice(0, 10), undefined, contractKm);
  const afterEighteen = ops.advance(customerId, 18);
  steps.push({ node: "ownership", title: "Eighteen months in service", output: { vehicle: afterEighteen.vehicle, contract: afterEighteen.contract } });

  // 6. Repair events: a stone chip on the headlamp, then hail on the roof.
  const headlamp = ops.reportEvent(customerId, "headlamp-lens-stone");
  steps.push({ node: "repair", title: "Stone chip cracks the headlamp lens", output: headlamp });
  ops.resolveEvent(customerId, "headlamp-lens-stone");
  const hail = ops.reportEvent(customerId, "hail-roof");
  steps.push({ node: "repair", title: "Hail dents the roof", output: hail });

  // 7. Year 5 of the vehicle's life arrives during the term; the hybrid battery falls below threshold: continue, refurbish or retire?
  ops.advance(customerId, 6);
  const battery = ops.reportEvent(customerId, "hybrid-battery-module");
  steps.push({ node: "repair", title: "Hybrid battery capacity below threshold", output: battery });
  const continuation = ops.reviewContinuation(customerId, 36);
  steps.push({
    node: "continuation",
    title: "Continue, refurbish or retire and reassign?",
    output: {
      decision: continuation.assessment.decision,
      reasoning: continuation.assessment.reasoning,
      asset: continuation.assessment.asset,
      placement: continuation.assessment.placement,
      retention: continuation.assessment.retention,
      alternative: continuation.alternative ? { offer: continuation.alternative.offer.id, fixedRate: continuation.alternative.rate.fixedRate.value } : undefined,
    },
  });

  // 8. What moves the answer: every provenanced input shocked +10% on the contracted placement, at the contracted distance.
  const sensitivity = ops.sensitivity(customerId, chosen.offer.id, { annualKm: contractKm });
  steps.push({
    node: "sensitivity",
    title: `What moves the answer: +${Math.round(sensitivity.shock * 100)}% on each input, ${chosen.vehicle.make} ${chosen.vehicle.model} ${chosen.offer.condition} at ${contractKm} km/yr`,
    output: {
      baseline: sensitivity.baseline,
      leading: sensitivity.leading,
      rows: sensitivity.rows.filter((row) => row.weight > 0).map(({ path, kind, deltas }) => ({ path, kind, ...deltas })),
      inert: sensitivity.rows.filter((row) => row.weight === 0).map((row) => row.path),
    },
  });

  const context = ops.context(customerId);
  steps.push({ node: "context", title: "Customer context after the journey", output: context.timeline.map((entry) => `${entry.node}: ${entry.summary}`) });

  const body = { household: FOUR_FIFTY_HOUSEHOLD, steps };
  return {
    scenario: "four-fifty",
    modelVersion: options.modelVersion,
    generatedAt: now().toISOString(),
    fixtureHashes: ops.fixtures.hashes,
    ...body,
    outputHash: createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16),
  };
}
