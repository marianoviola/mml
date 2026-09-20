import {
  compareAcquisitionModes,
  deriveMobilityRequirement,
  oneAtATimeSensitivity,
  type FinanceProducts,
  type Household,
  type InsuranceTariff,
  type ResidualCurves,
  type SensitivityResult,
  type Vehicle,
} from "@mml/core";
import type { Fixtures, Offer } from "@mml/data";

export interface PlacementSensitivityOutputs extends Record<string, number> {
  mml: number;
  ownership: number;
  longTermRental: number;
}

export interface PlacementSensitivity extends SensitivityResult<PlacementSensitivityOutputs> {
  offerId: string;
  vehicleId: string;
  termMonths: number;
  annualKm: number;
  /** Rows whose weight is at least this share of the largest weight are the ones the evidence work should start from. */
  leading: string[];
}

interface SensitivityInputs {
  vehicle: Vehicle;
  finance: FinanceProducts;
  insurance: InsuranceTariff;
  curves: ResidualCurves;
}

/**
 * Which inputs move the all-in monthly cost of one placement, under each
 * acquisition mode. The inputs shocked are the vehicle's own values and the
 * finance, insurance and residual-curve fixtures: everything the quote
 * reads that carries a provenance status. Offer prices are not shocked; an
 * offer is a quotation by nature and is replaced, not calibrated.
 */
export function placementSensitivity(
  fixtures: Fixtures,
  args: { offer: Offer; household: Household; termMonths?: number; annualKm?: number; shock?: number },
): PlacementSensitivity {
  const { offer, household } = args;
  const vehicle = fixtures.vehicles.find((candidate) => candidate.id === offer.vehicleId);
  if (!vehicle) throw new Error(`offer ${offer.id} references unknown vehicle ${offer.vehicleId}`);
  const requirement = deriveMobilityRequirement(household);
  const termMonths = args.termMonths ?? requirement.termMonths;
  const annualKm = args.annualKm ?? household.annualKm;

  const inputs: SensitivityInputs = { vehicle, finance: fixtures.finance, insurance: fixtures.insurance, curves: fixtures.curves };
  const evaluate = (shocked: SensitivityInputs): PlacementSensitivityOutputs => {
    const comparison = compareAcquisitionModes({
      vehicle: shocked.vehicle,
      household: { ...household, annualKm },
      purchasePrice: offer.price,
      termMonths,
      annualKm,
      finance: shocked.finance,
      insurance: shocked.insurance,
      curves: shocked.curves,
      placement: { ageYears: offer.ageYears, odometerKm: offer.odometerKm, condition: offer.vehicleCondition },
    });
    const monthly = (mode: string) => comparison.modes.find((candidate) => candidate.mode === mode)!.monthlyEquivalent.value;
    return { mml: monthly("mml"), ownership: monthly("ownership"), longTermRental: monthly("long-term-rental") };
  };

  const result = oneAtATimeSensitivity(inputs, evaluate, { shock: args.shock });
  const top = result.rows[0]?.weight ?? 0;
  return {
    offerId: offer.id,
    vehicleId: vehicle.id,
    termMonths,
    annualKm,
    ...result,
    leading: result.rows.filter((row) => top > 0 && row.weight >= top * 0.25).map((row) => row.path),
  };
}
