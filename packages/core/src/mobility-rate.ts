import { derived, round, type ProvenancedValue } from "./provenance.ts";
import { estimateRetention, type RetentionValues } from "./retention.ts";
import type {
  FinanceProducts,
  Household,
  InsuranceTariff,
  ResidualCurves,
  Vehicle,
  VehicleCondition,
} from "./types.ts";

/** Which life of the vehicle the contract starts in (chapter 2.6). */
export interface Placement {
  ageYears: number;
  odometerKm: number;
  condition: VehicleCondition;
}

export const NEW_PLACEMENT: Placement = { ageYears: 0, odometerKm: 0, condition: "excellent" };

export interface MobilityRateInput {
  monthlyCapital: number;
  monthlyMaintenance: number;
  monthlyRisk: number;
  monthlyAgency: number;
  monthlyLifecycleReserve: number;
  monthlyFinance: number;
  monthlyOperations: number;
  monthlyMargin: number;
}

export function mobilityRate(input: MobilityRateInput): number {
  return Object.values(input).reduce((total, value) => total + value, 0);
}

export interface MobilityRateComposition {
  vehicleId: string;
  placement: Placement;
  termMonths: number;
  annualKm: number;
  assetCost: ProvenancedValue;
  retentionAtStart: RetentionValues;
  components: Record<keyof MobilityRateInput, ProvenancedValue>;
  /** Chapter 2.3: the fixed rate. */
  fixedRate: ProvenancedValue;
  /** Chapter 2.3: the separately estimated variable cost of actual use. */
  variableUse: ProvenancedValue;
  allInMonthly: ProvenancedValue;
}

export function insurancePremiumPerYear(
  vehicle: Vehicle,
  household: Household,
  tariff: InsuranceTariff,
  fleet: boolean,
): number {
  const young = household.licenceYears < tariff.youngDriverMaxLicenceYears ? tariff.youngDriverUplift.value : 1;
  const base = vehicle.insuranceGroup * tariff.basePremiumPerGroupPoint.value * young;
  return fleet ? base * (1 - tariff.fleetDiscount.value) : base;
}

export function maintenancePerYear(vehicle: Vehicle, ageYears: number, annualKm: number, finance: FinanceProducts, uplift = 1): number {
  const ageFactor = 1 + finance.maintenanceAgeFactorPerYear.value * ageYears;
  const kmFactor = Math.pow(annualKm / finance.maintenanceReferenceAnnualKm.value, finance.maintenanceKmExponent.value);
  const tyres = finance.tyresPerKm.value * annualKm;
  return vehicle.maintenancePerYear.value * ageFactor * kmFactor * uplift + tyres;
}

export function energyPerMonth(vehicle: Vehicle, household: Household, annualKm: number): number {
  const perKm = household.homeCharging ? vehicle.energyCostPerKm.home.value : vehicle.energyCostPerKm.public.value;
  return (perKm * annualKm) / 12;
}

/**
 * Compose the Mobility Rate for one placement of one vehicle. The capital
 * charge is what the lifecycle system consumes of the asset during the
 * term, spread over the asset's remaining structural life rather than over
 * a first owner's depreciation curve; that is the whole difference between
 * MML and a long rental.
 */
export function composeMobilityRate(args: {
  vehicle: Vehicle;
  household: Household;
  placement?: Placement;
  termMonths: number;
  annualKm: number;
  finance: FinanceProducts;
  insurance: InsuranceTariff;
  curves: ResidualCurves;
}): MobilityRateComposition {
  const { vehicle, household, finance, insurance, curves, termMonths, annualKm } = args;
  const placement = args.placement ?? NEW_PLACEMENT;
  const life = vehicle.lifecycle;
  const retention = estimateRetention(vehicle, curves, placement.ageYears, placement.odometerKm, placement.condition);

  const isNew = placement.ageYears === 0;
  const assetCost = isNew
    ? vehicle.listPrice.value * (1 - finance.fleetDiscount.value)
    : retention.mobilityValue.value;
  const floor = retention.materialCapitalFloor.value;
  const remainingLifeMonths = Math.max(12, (life.structuralLifeYears.value - placement.ageYears) * 12);
  if (termMonths > remainingLifeMonths) {
    throw new RangeError(`term of ${termMonths} months exceeds the ${remainingLifeMonths} months of structural life remaining`);
  }
  const consumption = isNew ? finance.firstLifeConsumptionFactor.value : finance.laterLifeConsumptionFactor.value;
  const baseCapitalPerMonth = (assetCost - floor) / remainingLifeMonths;
  const capital = baseCapitalPerMonth * consumption;
  const averageOutstanding = assetCost - baseCapitalPerMonth * (termMonths / 2);
  const financeCharge = (averageOutstanding * finance.fleetCostOfCapital.value) / 12;
  const maintenance = maintenancePerYear(vehicle, placement.ageYears + termMonths / 24, annualKm, finance) / 12;
  const risk =
    insurancePremiumPerYear(vehicle, household, insurance, true) / 12 +
    (assetCost * finance.warrantyPoolShare.value) / 12;
  const refurbishmentsAhead = life.refurbishmentYears.filter((year) => year > placement.ageYears).length;
  const reserve = (life.refurbishmentCost.value * refurbishmentsAhead) / remainingLifeMonths;
  const agency = finance.agencyFeeMonthly.value;
  const operations = finance.operationsMonthly.value;
  const subtotal = capital + financeCharge + maintenance + risk + reserve + agency + operations;
  const margin = subtotal * finance.marginShare.value;

  const input: MobilityRateInput = {
    monthlyCapital: capital,
    monthlyFinance: financeCharge,
    monthlyMaintenance: maintenance,
    monthlyRisk: risk,
    monthlyLifecycleReserve: reserve,
    monthlyAgency: agency,
    monthlyOperations: operations,
    monthlyMargin: margin,
  };
  const fixed = mobilityRate(input);
  const variable = energyPerMonth(vehicle, household, annualKm);

  return {
    vehicleId: vehicle.id,
    placement,
    termMonths,
    annualKm,
    assetCost: derived(round(assetCost), isNew ? "list price less fleet discount" : "mobility value at placement age"),
    retentionAtStart: retention,
    components: {
      monthlyCapital: derived(round(capital, 2), `(asset cost − material floor) / ${remainingLifeMonths} remaining months × ${consumption} consumption factor`),
      monthlyFinance: derived(round(financeCharge, 2), "average capital outstanding during the term × fleet cost of capital"),
      monthlyMaintenance: derived(round(maintenance, 2), "scheduled maintenance at mid-term age and distance, plus tyres"),
      monthlyRisk: derived(round(risk, 2), "fleet insurance premium plus warranty pool"),
      monthlyLifecycleReserve: derived(round(reserve, 2), `${refurbishmentsAhead} refurbishment(s) ahead, provisioned over remaining life`),
      monthlyAgency: derived(round(agency, 2), "Agency service fee"),
      monthlyOperations: derived(round(operations, 2), "telematics, administration, reassignment logistics"),
      monthlyMargin: derived(round(margin, 2), "margin share of subtotal"),
    },
    fixedRate: derived(round(fixed), "sum of fixed components"),
    variableUse: derived(round(variable), household.homeCharging ? "energy at home rate × distance" : "energy at public or forecourt rate × distance"),
    allInMonthly: derived(round(fixed + variable), "fixed rate + estimated variable use"),
  };
}
