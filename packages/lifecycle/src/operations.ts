import {
  assessContinuation,
  assessRepair,
  assessVehicleFit,
  breakEven,
  compareAcquisitionModes,
  composeMobilityRate,
  deriveMobilityRequirement,
  estimateRetention,
  round,
  type AcquisitionComparison,
  type ContinuationAssessment,
  type Household,
  type MobilityRateComposition,
  type MobilityRequirement,
  type Placement,
  type RepairAssessment,
  type RetentionValues,
  type Vehicle,
  type VehicleFit,
} from "@mml/core";
import { loadFixtures, type Fixtures, type Offer } from "@mml/data";
import type { ContextStore, CustomerContext } from "./context.ts";
import { placementSensitivity, type PlacementSensitivity } from "./sensitivity.ts";
import { placementBreakEvens, type PlacementBreakEvens } from "./break-even.ts";

export interface OfferQuote {
  offer: Offer;
  vehicle: Vehicle;
  rate: MobilityRateComposition;
  withinBudget: boolean;
  budgetGap: number;
}

export interface ShortlistResult {
  requirement: MobilityRequirement;
  eligible: OfferQuote[];
  excluded: Array<{ vehicle: Vehicle; reasons: string[] }>;
}

export type BudgetAdjustment =
  | { kind: "distance"; annualKm: number; allIn: number; note: string }
  | { kind: "later-life"; offerId: string; allIn: number; note: string }
  | { kind: "budget"; annualKm: number; requiredBudget: number; note: string }
  | { kind: "none"; note: string };

/** Below this a family's declared use is not a distance adjustment but a different requirement. */
const MINIMUM_ANNUAL_KM = 10000;

export interface QuoteResult {
  quote: OfferQuote;
  comparison: AcquisitionComparison;
  /** What would have to change for this offer to meet the budget; empty when it already does. */
  adjustments: BudgetAdjustment[];
}

export interface EventResult {
  assessment: RepairAssessment;
  continuity: string;
  ownershipContrast: string;
}

export interface ContinuationResult {
  assessment: ContinuationAssessment;
  alternative?: OfferQuote;
}

const placementOf = (offer: Offer): Placement => ({
  ageYears: offer.ageYears,
  odometerKm: offer.odometerKm,
  condition: offer.vehicleCondition,
});

/**
 * The operations of the lifecycle graph. Each one reads and writes the
 * customer context, so any entry point continues the same relationship.
 * Adapters (MCP, CLI) call these and add nothing of their own.
 */
export class LifecycleOperations {
  readonly fixtures: Fixtures;
  private readonly store: ContextStore;

  constructor(store: ContextStore, fixtures?: Fixtures) {
    this.store = store;
    this.fixtures = fixtures ?? loadFixtures();
  }

  private vehicle(id: string): Vehicle {
    const vehicle = this.fixtures.vehicles.find((candidate) => candidate.id === id);
    if (!vehicle) throw new Error(`unknown vehicle: ${id}`);
    return vehicle;
  }

  private offer(id: string): Offer {
    const offer = this.fixtures.offers.find((candidate) => candidate.id === id);
    if (!offer) throw new Error(`unknown offer: ${id}`);
    return offer;
  }

  private requireHousehold(context: CustomerContext): { household: Household; requirement: MobilityRequirement } {
    if (!context.household || !context.requirement) {
      throw new Error(`customer ${context.id} has no household profile yet; capture it first`);
    }
    return { household: context.household, requirement: context.requirement };
  }

  private quoteOffer(household: Household, requirement: MobilityRequirement, offer: Offer, termMonths?: number, annualKm?: number): OfferQuote {
    const vehicle = this.vehicle(offer.vehicleId);
    const { finance, insurance, curves, energy } = this.fixtures;
    const rate = composeMobilityRate({
      vehicle,
      household,
      placement: placementOf(offer),
      termMonths: termMonths ?? requirement.termMonths,
      annualKm: annualKm ?? requirement.annualKm,
      finance,
      insurance,
      curves,
      energy,
    });
    const gap = rate.allInMonthly.value - household.monthlyBudget;
    return { offer, vehicle, rate, withinBudget: gap <= 0, budgetGap: round(gap) };
  }

  captureHousehold(customerId: string, household: Household): { context: CustomerContext; requirement: MobilityRequirement } {
    const context = this.store.getOrCreate(customerId);
    const requirement = deriveMobilityRequirement(household);
    context.household = household;
    context.requirement = requirement;
    this.store.append(
      context,
      "requirement",
      `Household of ${household.adults + household.children} declares €${household.monthlyBudget}/month all-in; class ${requirement.mobilityClass}, ${requirement.annualKm} km/yr, ${requirement.termMonths} months.`,
      requirement,
    );
    return { context, requirement };
  }

  shortlist(customerId: string): ShortlistResult {
    const context = this.store.get(customerId);
    const { household, requirement } = this.requireHousehold(context);
    const fits: VehicleFit[] = this.fixtures.vehicles.map((vehicle) => assessVehicleFit(vehicle, requirement, household));
    const eligible: OfferQuote[] = [];
    for (const fit of fits.filter((candidate) => candidate.fits)) {
      for (const offer of this.fixtures.offers.filter((candidate) => candidate.vehicleId === fit.vehicle.id)) {
        eligible.push(this.quoteOffer(household, requirement, offer));
      }
    }
    eligible.sort((a, b) => a.rate.allInMonthly.value - b.rate.allInMonthly.value);
    context.shortlist = eligible.map((quote) => quote.offer.id);
    const within = eligible.filter((quote) => quote.withinBudget);
    this.store.append(
      context,
      "shortlist",
      `${eligible.length} eligible placement(s); ${within.length} within €${household.monthlyBudget}. Cheapest: ${eligible[0]?.offer.id ?? "none"} at €${eligible[0]?.rate.allInMonthly.value ?? "-"}.`,
      context.shortlist,
    );
    return {
      requirement,
      eligible,
      excluded: fits.filter((candidate) => !candidate.fits).map(({ vehicle, reasons }) => ({ vehicle, reasons })),
    };
  }

  quote(customerId: string, offerId: string, termMonths?: number, annualKm?: number): QuoteResult {
    const context = this.store.get(customerId);
    const { household, requirement } = this.requireHousehold(context);
    const offer = this.offer(offerId);
    const quote = this.quoteOffer(household, requirement, offer, termMonths, annualKm);
    const { finance, insurance, curves, energy } = this.fixtures;
    const comparison = compareAcquisitionModes({
      vehicle: quote.vehicle,
      household,
      purchasePrice: offer.price,
      termMonths: termMonths ?? requirement.termMonths,
      annualKm: annualKm ?? requirement.annualKm,
      finance,
      insurance,
      curves,
      energy,
      placement: placementOf(offer),
    });
    const adjustments: BudgetAdjustment[] = [];
    if (!quote.withinBudget) {
      const km = annualKm ?? requirement.annualKm;
      const allInAt = (candidateKm: number) => this.quoteOffer(household, requirement, offer, termMonths, candidateKm).rate.allInMonthly.value;
      const breakEvenKm = km > MINIMUM_ANNUAL_KM ? breakEven(allInAt, household.monthlyBudget, MINIMUM_ANNUAL_KM, km, { step: 500 }) : undefined;
      if (breakEvenKm !== undefined) {
        const trial = this.quoteOffer(household, requirement, offer, termMonths, breakEvenKm);
        const settledKm = trial.withinBudget ? breakEvenKm : breakEvenKm - 500;
        const settled = trial.withinBudget ? trial : this.quoteOffer(household, requirement, offer, termMonths, settledKm);
        adjustments.push({
          kind: "distance",
          annualKm: settledKm,
          allIn: settled.rate.allInMonthly.value,
          note: `At ${settledKm} km/yr this placement is €${settled.rate.allInMonthly.value}/month, within budget.`,
        });
      }
      const laterLives = this.fixtures.offers.filter(
        (candidate) => candidate.vehicleId === offer.vehicleId && candidate.ageYears > offer.ageYears,
      );
      for (const later of laterLives) {
        const trial = this.quoteOffer(household, requirement, later, termMonths, annualKm);
        if (trial.withinBudget) {
          adjustments.push({
            kind: "later-life",
            offerId: later.id,
            allIn: trial.rate.allInMonthly.value,
            note: `The same model in a later life (${later.condition}, ${later.ageYears} years) is €${trial.rate.allInMonthly.value}/month, within budget.`,
          });
          break;
        }
      }
      if (adjustments.length === 0) {
        const atDeclared = quote.rate.allInMonthly.value;
        const atFloor = km > MINIMUM_ANNUAL_KM ? allInAt(MINIMUM_ANNUAL_KM) : atDeclared;
        adjustments.push({
          kind: "budget",
          annualKm: km,
          requiredBudget: atDeclared,
          note:
            `No distance down to ${MINIMUM_ANNUAL_KM} km/yr brings this placement within €${household.monthlyBudget}: it needs €${atDeclared}/month at ${km} km/yr` +
            (atFloor < atDeclared ? ` and €${atFloor}/month at ${MINIMUM_ANNUAL_KM} km/yr.` : ".") +
            " What has to give is the budget or the class.",
        });
      }
    }
    this.store.append(
      context,
      "comparison",
      `Quoted ${offer.id}: ownership €${comparison.modes[0].monthlyEquivalent.value}, rental €${comparison.modes[1].monthlyEquivalent.value}, MML €${comparison.modes[2].monthlyEquivalent.value} all-in.`,
      { offerId: offer.id, modes: comparison.modes.map((mode) => [mode.mode, mode.monthlyEquivalent.value]) },
    );
    return { quote, comparison, adjustments };
  }

  /** What moves this customer's quote for one placement: every provenanced input shocked one at a time. Not a graph node; it reads the context and writes nothing. */
  sensitivity(customerId: string, offerId: string, options: { termMonths?: number; annualKm?: number; shock?: number } = {}): PlacementSensitivity {
    const context = this.store.get(customerId);
    const { household, requirement } = this.requireHousehold(context);
    return placementSensitivity(this.fixtures, {
      offer: this.offer(offerId),
      household,
      termMonths: options.termMonths ?? requirement.termMonths,
      annualKm: options.annualKm ?? requirement.annualKm,
      shock: options.shock,
    });
  }

  /** Break-even questions for one placement: distance for the budget, and structural life, cost of capital and consumption factor against long-term rental. Reads the context, writes nothing. */
  breakEvens(customerId: string, offerId: string, options: { termMonths?: number; annualKm?: number } = {}): PlacementBreakEvens {
    const context = this.store.get(customerId);
    const { household, requirement } = this.requireHousehold(context);
    return placementBreakEvens(this.fixtures, {
      offer: this.offer(offerId),
      household,
      termMonths: options.termMonths ?? requirement.termMonths,
      annualKm: options.annualKm ?? requirement.annualKm,
    });
  }

  contract(customerId: string, offerId: string, startedAt: string, termMonths?: number, annualKm?: number): CustomerContext {
    const context = this.store.get(customerId);
    const { household, requirement } = this.requireHousehold(context);
    const offer = this.offer(offerId);
    const quote = this.quoteOffer(household, requirement, offer, termMonths, annualKm);
    const placement = placementOf(offer);
    context.contract = {
      offerId,
      vehicleId: offer.vehicleId,
      placement,
      termMonths: termMonths ?? requirement.termMonths,
      annualKm: annualKm ?? requirement.annualKm,
      startedAt,
      monthsElapsed: 0,
      fixedRate: quote.rate.fixedRate.value,
      variableUseEstimate: quote.rate.variableUse.value,
      materialCapitalCredit: 0,
      materialCapitalFloor: quote.rate.retentionAtStart.materialCapitalFloor.value,
    };
    context.vehicle = { ...placement, openEvents: [] };
    this.store.append(
      context,
      "contract",
      `Contract on ${offer.id} (${quote.vehicle.make} ${quote.vehicle.model}, ${offer.condition}): fixed €${context.contract.fixedRate}/month, variable ≈ €${context.contract.variableUseEstimate}, term ${context.contract.termMonths} months.`,
      context.contract,
    );
    return context;
  }

  /** Time passes: the vehicle ages, distance accrues, the credit builds, the timeline records ownership. */
  advance(customerId: string, months: number, kmDriven?: number): CustomerContext {
    const context = this.store.get(customerId);
    if (!context.contract || !context.vehicle) throw new Error(`customer ${customerId} has no active contract`);
    const contract = context.contract;
    const km = kmDriven ?? (contract.annualKm * months) / 12;
    context.vehicle.ageYears = round(context.vehicle.ageYears + months / 12, 2);
    context.vehicle.odometerKm = Math.round(context.vehicle.odometerKm + km);
    contract.monthsElapsed += months;
    const accrual = contract.materialCapitalFloor / contract.termMonths;
    contract.materialCapitalCredit = round(Math.min(contract.materialCapitalFloor, contract.materialCapitalCredit + accrual * months));
    const vehicle = this.vehicle(contract.vehicleId);
    const due = vehicle.lifecycle.refurbishmentYears.filter(
      (year) => year > context.vehicle!.ageYears - months / 12 && year <= context.vehicle!.ageYears,
    );
    this.store.append(
      context,
      "ownership",
      `${months} month(s) elapsed, ${Math.round(km)} km driven; vehicle now ${context.vehicle.ageYears} years, ${context.vehicle.odometerKm} km. Material Capital Credit €${contract.materialCapitalCredit}.${due.length ? ` Refurbishment due (year ${due.join(", ")}).` : ""}`,
      { vehicle: context.vehicle, credit: contract.materialCapitalCredit },
    );
    return context;
  }

  reportEvent(customerId: string, eventId: string): EventResult {
    const context = this.store.get(customerId);
    if (!context.contract || !context.vehicle) throw new Error(`customer ${customerId} has no active contract`);
    const event = this.fixtures.repairEvents.find((candidate) => candidate.id === eventId);
    if (!event) throw new Error(`unknown repair event: ${eventId}`);
    const vehicle = this.vehicle(context.contract.vehicleId);
    const assessment = assessRepair(vehicle, event);
    if (assessment.response === "intervene" || assessment.response === "correct") {
      context.vehicle.openEvents.push(eventId);
    }
    const continuity = assessment.replacementMobilityRequired
      ? `Replacement mobility assigned for ${assessment.downtimeDays} day(s); the Mobility Rate does not change.`
      : "No interruption: the vehicle stays in service while the repair is scheduled.";
    const ownershipContrast = assessment.ownershipValueLoss
      ? `Under ownership the same event would cost the household about €${assessment.ownershipValueLoss.value} of resale value on top of the repair; under MML the asset ledger carries it.`
      : `Under ownership the household would pay €${event.assemblyReplacementCost.value} for the assembly and arrange its own transport.`;
    this.store.append(
      context,
      "repair",
      `${event.label}: ${assessment.state}, ${assessment.chosen} at €${assessment.chosenCost.value}${assessment.savingVersusAssembly.value > 0 ? ` (saves €${assessment.savingVersusAssembly.value} against the assembly)` : ""}. ${continuity}`,
      assessment,
    );
    return { assessment, continuity, ownershipContrast };
  }

  resolveEvent(customerId: string, eventId: string): CustomerContext {
    const context = this.store.get(customerId);
    if (!context.vehicle) throw new Error(`customer ${customerId} has no vehicle`);
    context.vehicle.openEvents = context.vehicle.openEvents.filter((id) => id !== eventId);
    this.store.append(context, "service", `Event ${eventId} resolved and recorded in the asset ledger.`);
    return context;
  }

  retention(customerId: string): RetentionValues {
    const context = this.store.get(customerId);
    if (!context.contract || !context.vehicle) throw new Error(`customer ${customerId} has no active contract`);
    const vehicle = this.vehicle(context.contract.vehicleId);
    return estimateRetention(vehicle, this.fixtures.curves, context.vehicle.ageYears, context.vehicle.odometerKm, context.vehicle.condition);
  }

  /** Chapter 3.10: how much of the original vehicle needs to remain? Decide on the fleet's money. */
  reviewContinuation(customerId: string, horizonMonths = 36): ContinuationResult {
    const context = this.store.get(customerId);
    if (!context.contract || !context.vehicle) throw new Error(`customer ${customerId} has no active contract`);
    const { household, requirement } = this.requireHousehold(context);
    const vehicle = this.vehicle(context.contract.vehicleId);
    const retention = this.retention(customerId);
    const pending = context.vehicle.openEvents
      .map((id) => assessRepair(vehicle, this.fixtures.repairEvents.find((event) => event.id === id)!).chosenCost.value)
      .reduce((total, cost) => total + cost, 0);

    const currentRate = composeMobilityRate({
      vehicle,
      household,
      placement: { ageYears: context.vehicle.ageYears, odometerKm: context.vehicle.odometerKm, condition: context.vehicle.condition },
      termMonths: Math.min(horizonMonths, (vehicle.lifecycle.structuralLifeYears.value - context.vehicle.ageYears) * 12),
      annualKm: context.contract.annualKm,
      finance: this.fixtures.finance,
      insurance: this.fixtures.insurance,
      curves: this.fixtures.curves,
      energy: this.fixtures.energy,
    });
    const alternatives = this.fixtures.offers
      .filter((offer) => offer.source === "fleet" && offer.id !== context.contract!.offerId)
      .map((offer) => this.quoteOffer(household, requirement, offer, horizonMonths, context.contract!.annualKm))
      .filter((quote) => assessVehicleFit(quote.vehicle, requirement, household).fits)
      .sort((a, b) => a.rate.fixedRate.value - b.rate.fixedRate.value);
    const alternative = alternatives[0];

    const assessment = assessContinuation({
      vehicle,
      retention,
      pendingRepairCost: pending,
      horizonMonths,
      currentMonthlyFixed: currentRate.fixedRate.value,
      alternativeMonthlyFixed: alternative?.rate.fixedRate.value ?? currentRate.fixedRate.value,
      reassignmentCost: this.fixtures.finance.reassignmentCost.value,
    });
    this.store.append(
      context,
      "continuation",
      `Decision at ${retention.ageYears} years / ${retention.odometerKm} km: ${assessment.decision}. Mobility value €${retention.mobilityValue.value}, CRV €${retention.componentRetentionValue.value}, MRV €${retention.materialRetentionValue.value}.`,
      assessment,
    );
    return { assessment, alternative };
  }

  context(customerId: string): CustomerContext {
    return this.store.get(customerId);
  }
}
