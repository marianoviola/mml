import { annuityPayment } from "./dcf.ts";
import { derived, round, type ProvenancedValue } from "./provenance.ts";
import {
  composeMobilityRate,
  energyPerMonth,
  insurancePremiumPerYear,
  maintenancePerYear,
  type MobilityRateComposition,
  type Placement,
} from "./mobility-rate.ts";
import { estimateRetention } from "./retention.ts";
import type { FinanceProducts, Household, InsuranceTariff, ResidualCurves, Vehicle } from "./types.ts";

export type AcquisitionMode = "ownership" | "long-term-rental" | "mml";

export interface ModeCost {
  mode: AcquisitionMode;
  monthlyEquivalent: ProvenancedValue;
  fixed: ProvenancedValue;
  variableUse: ProvenancedValue;
  breakdown: Record<string, ProvenancedValue>;
  notes: string[];
}

export interface AcquisitionComparison {
  vehicleId: string;
  termMonths: number;
  annualKm: number;
  purchasePrice: number;
  modes: ModeCost[];
  mml: MobilityRateComposition;
}

/**
 * Chapter 2: ownership, long-term rental and MML blend the same three
 * transactions differently. Put them on one monthly-equivalent footing for
 * the same vehicle, term and distance so the household can see what each
 * mode is charging for.
 */
export function compareAcquisitionModes(args: {
  vehicle: Vehicle;
  household: Household;
  purchasePrice: number;
  termMonths: number;
  annualKm: number;
  finance: FinanceProducts;
  insurance: InsuranceTariff;
  curves: ResidualCurves;
  placement?: Placement;
}): AcquisitionComparison {
  const { vehicle, household, purchasePrice, termMonths, annualKm, finance, insurance, curves } = args;
  const placement = args.placement ?? { ageYears: 0, odometerKm: 0, condition: "excellent" as const };
  const years = termMonths / 12;
  const endAge = placement.ageYears + years;
  const endKm = placement.odometerKm + annualKm * years;
  const energy = energyPerMonth(vehicle, household, annualKm);
  const maintenanceRetail = maintenancePerYear(vehicle, placement.ageYears + years / 2, annualKm, finance.retailMaintenanceUplift.value) / 12;

  // Ownership: buy at the offer price, finance a share, sell at the end at the market curve.
  const residual = estimateRetention(vehicle, curves, endAge, endKm, "good").mobilityValue.value;
  const depreciation = (purchasePrice - residual) / termMonths;
  const financed = purchasePrice * finance.loanFinancedShare.value;
  const payment = annuityPayment(financed, finance.loanApr.value, termMonths);
  const interest = (payment * termMonths - financed) / termMonths;
  const ownershipInsurance = insurancePremiumPerYear(vehicle, household, insurance, false) / 12;
  const tax = finance.ownershipTaxMonthly.value;
  const repairProvision = (purchasePrice * finance.ownershipRepairProvisionShare.value) / 12;
  const ownershipFixed = depreciation + interest + ownershipInsurance + maintenanceRetail + tax + repairProvision;

  // Long-term rental: the lessor prices depreciation over the term, its cost of capital, services and margin.
  const nltCapital = (purchasePrice * (1 - finance.fleetDiscount.value) - residual) / termMonths;
  const nltFinance = (((purchasePrice * (1 - finance.fleetDiscount.value) + residual) / 2) * finance.nltCostOfCapital.value) / 12;
  const nltInsurance = insurancePremiumPerYear(vehicle, household, insurance, true) / 12;
  const nltServices = maintenancePerYear(vehicle, placement.ageYears + years / 2, annualKm) / 12 + finance.operationsMonthly.value;
  const nltSubtotal = nltCapital + nltFinance + nltInsurance + nltServices;
  const nltFixed = nltSubtotal * (1 + finance.nltMarginShare.value);

  const mml = composeMobilityRate({ vehicle, household, placement, termMonths, annualKm, finance, insurance, curves });

  const modes: ModeCost[] = [
    {
      mode: "ownership",
      fixed: derived(round(ownershipFixed), "depreciation + interest + retail insurance + retail maintenance + tax + unplanned repair provision"),
      variableUse: derived(round(energy), "energy"),
      monthlyEquivalent: derived(round(ownershipFixed + energy), "fixed + energy"),
      breakdown: {
        depreciation: derived(round(depreciation), `(${purchasePrice} − ${round(residual)} resale) / ${termMonths}`),
        interest: derived(round(interest), `loan on ${round(financed)} at ${round(finance.loanApr.value * 100, 2)}% APR`),
        insurance: derived(round(ownershipInsurance), "retail premium"),
        maintenance: derived(round(maintenanceRetail), "retail servicing and tyres"),
        tax: derived(round(tax), "ownership tax"),
        repairProvision: derived(round(repairProvision), "expected unplanned repair, unpooled"),
      },
      notes: [
        "The household carries residual-value risk, repair risk and downtime alone.",
        `Resale at month ${termMonths} assumes good condition; a hail roof or an unrepaired event lands on this number.`,
      ],
    },
    {
      mode: "long-term-rental",
      fixed: derived(round(nltFixed), "term depreciation + lessor cost of capital + insurance + services + margin"),
      variableUse: derived(round(energy), "energy"),
      monthlyEquivalent: derived(round(nltFixed + energy), "fixed + energy"),
      breakdown: {
        depreciation: derived(round(nltCapital), "lessor cost less residual, over the term"),
        finance: derived(round(nltFinance), "lessor cost of capital"),
        insurance: derived(round(nltInsurance), "fleet premium"),
        services: derived(round(nltServices), "maintenance and administration"),
        margin: derived(round(nltSubtotal * finance.nltMarginShare.value), "lessor margin"),
      },
      notes: [
        "Depreciation is priced over the rental term as if the vehicle's life ended at return.",
        "Condition at return is settled as a penalty, not priced into the rate.",
        ...(placement.ageYears > 0 ? ["Long-term rental of a later-life vehicle is rarely offered; shown on the same footing for comparability."] : []),
      ],
    },
    {
      mode: "mml",
      fixed: mml.fixedRate,
      variableUse: mml.variableUse,
      monthlyEquivalent: mml.allInMonthly,
      breakdown: mml.components,
      notes: [
        "Capital is charged as consumption of the asset over its structural life, not as first-owner depreciation.",
        "Normal use is priced in; the asset returns to the fleet for its next life at the end of the term.",
      ],
    },
  ];

  return { vehicleId: vehicle.id, termMonths, annualKm, purchasePrice, modes, mml };
}
