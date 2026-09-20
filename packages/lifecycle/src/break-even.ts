import {
  breakEven,
  compareAcquisitionModes,
  deriveMobilityRequirement,
  round,
  withProvenancedValue,
  type EnergyPrices,
  type FinanceProducts,
  type Household,
  type InsuranceTariff,
  type ResidualCurves,
  type Vehicle,
} from "@mml/core";
import type { Fixtures, Offer } from "@mml/data";

export interface BreakEvenRow {
  /** The question in words, as the publication would ask it. */
  question: string;
  /** The input solved for: a fixture path, or `annualKm` for distance. */
  input: string;
  /** What the input has to reach; undefined when no value in the range gets there. */
  value: number | undefined;
  range: [number, number];
  /** The input's central value, for the distance between here and there. */
  central: number;
  note: string;
}

export interface PlacementBreakEvens {
  offerId: string;
  termMonths: number;
  annualKm: number;
  monthlyBudget: number;
  central: { mml: number; ownership: number; longTermRental: number };
  rows: BreakEvenRow[];
}

interface Inputs {
  vehicle: Vehicle;
  finance: FinanceProducts;
  insurance: InsuranceTariff;
  curves: ResidualCurves;
  energy: EnergyPrices;
}

/**
 * Roadmap M5, break-even: the value of one input at which MML meets the
 * household's budget, or costs what long-term rental costs for the same
 * vehicle, term and distance. Rental is the comparator because it is the
 * mode a household can actually buy today for a monthly sum; ownership is
 * shown alongside but carries the risks the rate does not.
 */
export function placementBreakEvens(
  fixtures: Fixtures,
  args: { offer: Offer; household: Household; termMonths?: number; annualKm?: number },
): PlacementBreakEvens {
  const { offer, household } = args;
  const vehicle = fixtures.vehicles.find((candidate) => candidate.id === offer.vehicleId);
  if (!vehicle) throw new Error(`offer ${offer.id} references unknown vehicle ${offer.vehicleId}`);
  const requirement = deriveMobilityRequirement(household);
  const termMonths = args.termMonths ?? requirement.termMonths;
  const annualKm = args.annualKm ?? household.annualKm;
  const base: Inputs = { vehicle, finance: fixtures.finance, insurance: fixtures.insurance, curves: fixtures.curves, energy: fixtures.energy };

  const modes = (inputs: Inputs, km: number) => {
    const comparison = compareAcquisitionModes({
      vehicle: inputs.vehicle,
      household: { ...household, annualKm: km },
      purchasePrice: offer.price,
      termMonths,
      annualKm: km,
      finance: inputs.finance,
      insurance: inputs.insurance,
      curves: inputs.curves,
      energy: inputs.energy,
      placement: { ageYears: offer.ageYears, odometerKm: offer.odometerKm, condition: offer.vehicleCondition },
    });
    const monthly = (mode: string) => comparison.modes.find((candidate) => candidate.mode === mode)!.monthlyEquivalent.value;
    return { mml: monthly("mml"), ownership: monthly("ownership"), longTermRental: monthly("long-term-rental") };
  };
  const central = modes(base, annualKm);
  const gapToRental = (path: string) => (value: number) => {
    const shocked = withProvenancedValue(base, path, value);
    const result = modes(shocked, annualKm);
    return result.mml - result.longTermRental;
  };
  const rows: BreakEvenRow[] = [];

  // 1. Distance: the budget question, bounded below by what a family's use can honestly be.
  const minimumKm = 10000;
  const kmRange: [number, number] = [minimumKm, annualKm];
  const km = annualKm > minimumKm ? breakEven((value) => modes(base, value).mml, household.monthlyBudget, minimumKm, annualKm, { step: 500 }) : undefined;
  rows.push({
    question: `At what yearly distance does this placement meet €${household.monthlyBudget} all-in under MML?`,
    input: "annualKm",
    value: km,
    range: kmRange,
    central: annualKm,
    note: km === undefined
      ? `None between ${minimumKm} and ${annualKm} km/yr: €${modes(base, minimumKm).mml} at ${minimumKm} km/yr, €${central.mml} at ${annualKm}. The budget or the class has to move.`
      : `€${modes(base, km).mml} at ${km} km/yr against €${central.mml} at ${annualKm}.`,
  });

  // 2. Structural life: the thesis's own quantity. How long must the vehicle live for the lifecycle rate to cost what a rental costs?
  const minimumLife = offer.ageYears + termMonths / 12 + 1;
  const lifeRange: [number, number] = [Math.ceil(minimumLife), 30];
  const lifePath = "vehicle.lifecycle.structuralLifeYears";
  const life = breakEven(gapToRental(lifePath), 0, lifeRange[0], lifeRange[1], { step: 0.5 });
  rows.push({
    question: "How long must the vehicle's structural life be for MML to cost what long-term rental costs?",
    input: lifePath,
    value: life,
    range: lifeRange,
    central: vehicle.lifecycle.structuralLifeYears.value,
    note: life === undefined
      ? `No structural life up to ${lifeRange[1]} years closes the gap: MML €${central.mml} against rental €${central.longTermRental} at ${vehicle.lifecycle.structuralLifeYears.value} years.`
      : `${life} years against the central ${vehicle.lifecycle.structuralLifeYears.value}; MML €${central.mml} and rental €${central.longTermRental} at the central value.`,
  });

  // 3. Fleet cost of capital: the price of money the asset company would need.
  const capitalPath = "finance.fleetCostOfCapital";
  const capitalRange: [number, number] = [0, 0.15];
  const capital = breakEven(gapToRental(capitalPath), 0, capitalRange[0], capitalRange[1], { tolerance: 0.0005 });
  rows.push({
    question: "At what fleet cost of capital does MML cost what long-term rental costs?",
    input: capitalPath,
    value: capital === undefined ? undefined : round(capital, 4),
    range: capitalRange,
    central: fixtures.finance.fleetCostOfCapital.value,
    note: capital === undefined
      ? `No cost of capital between 0 and 15% closes the gap on its own.`
      : `${round(capital * 100, 2)}% against the central ${round(fixtures.finance.fleetCostOfCapital.value * 100, 2)}%.`,
  });

  // 4. Consumption factor for this life: how slowly must the asset be consumed.
  const consumptionPath = offer.ageYears === 0 ? "finance.firstLifeConsumptionFactor" : "finance.laterLifeConsumptionFactor";
  const consumptionRange: [number, number] = [0.2, 2];
  const consumption = breakEven(gapToRental(consumptionPath), 0, consumptionRange[0], consumptionRange[1], { tolerance: 0.005 });
  const consumptionCentral = offer.ageYears === 0 ? fixtures.finance.firstLifeConsumptionFactor.value : fixtures.finance.laterLifeConsumptionFactor.value;
  rows.push({
    question: `At what ${offer.ageYears === 0 ? "first" : "later"}-life consumption factor does MML cost what long-term rental costs?`,
    input: consumptionPath,
    value: consumption === undefined ? undefined : round(consumption, 2),
    range: consumptionRange,
    central: consumptionCentral,
    note: consumption === undefined
      ? `No consumption factor between ${consumptionRange[0]} and ${consumptionRange[1]} closes the gap on its own.`
      : `${round(consumption, 2)} against the central ${consumptionCentral}.`,
  });

  return { offerId: offer.id, termMonths, annualKm, monthlyBudget: household.monthlyBudget, central, rows };
}
