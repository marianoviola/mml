import type { ProvenancedSeries, ProvenancedValue } from "./provenance.ts";

export type Powertrain = "ice" | "mhev" | "hev" | "phev" | "bev";

/** The illustrative classes of chapter 2, table 2.1. */
export type MobilityClass =
  | "urban-compact"
  | "compact-mixed"
  | "family-touring"
  | "family-electric"
  | "large-family";

export interface Household {
  adults: number;
  children: number;
  /** Regular journeys above ~300 km. */
  longJourneys: boolean;
  annualKm: number;
  /** Monthly all-in budget the household declares before quotation. */
  monthlyBudget: number;
  homeCharging: boolean;
  /** Reliable public charging near home or work. */
  publicChargingAccess: boolean;
  /** Years the main driver has held a licence. */
  licenceYears: number;
  /** Prefers compact external dimensions (dense city parking). */
  compactPreferred?: boolean;
  /** Needs a high luggage requirement independently of seats (e.g. equipment, dog). */
  highLuggage?: boolean;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  mobilityClass: MobilityClass;
  powertrain: Powertrain;
  seats: number;
  luggageLitres: number;
  /** Scale reference for modelling, not a quotation. */
  listPrice: ProvenancedValue;
  /** Energy cost per km at the household's charging or fuel conditions. */
  energyCostPerKm: { home: ProvenancedValue; public: ProvenancedValue };
  maintenancePerYear: ProvenancedValue;
  insuranceGroup: number;
  kerbMassKg: ProvenancedValue;
  residualCurve: "ice" | "hev" | "bev";
  lifecycle: {
    /** Chapter 3.1: which transition stage the model line can occupy today. */
    stage: "mml-compatible" | "mml-adapted" | "mml-native";
    structuralLifeYears: ProvenancedValue;
    softwareSupportHorizonYears: ProvenancedValue;
    partsAvailability: "high" | "medium" | "low";
    /** Lighting designed with a separable lens/housing (chapter 3.6). */
    modularLighting: boolean;
    refurbishmentYears: number[];
    refurbishmentCost: ProvenancedValue;
  };
}

export interface FinanceProducts {
  /** Retail loan for private purchase. */
  loanApr: ProvenancedValue;
  loanFinancedShare: ProvenancedValue;
  /** Long-term rental (NLT) pricing factors. */
  nltMarginShare: ProvenancedValue;
  nltCostOfCapital: ProvenancedValue;
  /** MML fleet economics. */
  fleetDiscount: ProvenancedValue;
  fleetCostOfCapital: ProvenancedValue;
  agencyFeeMonthly: ProvenancedValue;
  operationsMonthly: ProvenancedValue;
  marginShare: ProvenancedValue;
  warrantyPoolShare: ProvenancedValue;
  /** New vehicles consume more mobility value per month than later lives (chapter 2.7). */
  firstLifeConsumptionFactor: ProvenancedValue;
  laterLifeConsumptionFactor: ProvenancedValue;
  ownershipTaxMonthly: ProvenancedValue;
  retailMaintenanceUplift: ProvenancedValue;
  ownershipRepairProvisionShare: ProvenancedValue;
  /** Scheduled maintenance scaling: cost grows with age, scales sub-linearly with distance, tyres are per km. */
  maintenanceAgeFactorPerYear: ProvenancedValue;
  maintenanceReferenceAnnualKm: ProvenancedValue;
  maintenanceKmExponent: ProvenancedValue;
  tyresPerKm: ProvenancedValue;
  reassignmentCost: ProvenancedValue;
}

export interface InsuranceTariff {
  basePremiumPerGroupPoint: ProvenancedValue;
  fleetDiscount: ProvenancedValue;
  youngDriverUplift: ProvenancedValue;
  youngDriverMaxLicenceYears: number;
}

export interface ResidualCurves {
  /** Fraction of list price retained at each integer age, index = years. */
  curves: Record<"ice" | "hev" | "bev", ProvenancedSeries>;
  referenceAnnualKm: ProvenancedValue;
  kmAdjustmentPer5000: ProvenancedValue;
  /** Component Retention Value as a fraction of list price by age. */
  componentRetention: ProvenancedSeries;
  /** Net recoverable material value per kg after processing. */
  materialValuePerKg: ProvenancedValue;
  /** Chapter 2.5: the share of material retention value held as the Material Capital Credit floor. */
  materialCapitalFloorShare: ProvenancedValue;
  conditionAdjustment: Record<VehicleCondition, ProvenancedValue>;
}

export type VehicleCondition = "excellent" | "good" | "fair" | "poor";

/** Chapter 3.8: the three states a lifecycle standard must distinguish. */
export type ConditionState = "safety-defect" | "maintenance-shortfall" | "cosmetic";

export interface RepairEventType {
  id: string;
  label: string;
  state: ConditionState;
  /** Conventional response: replace the assembly. */
  assemblyReplacementCost: ProvenancedValue;
  /** Modular or local repair where the design allows it. */
  modularRepairCost?: ProvenancedValue;
  requiresModularLighting?: boolean;
  downtimeDaysAssembly: number;
  downtimeDaysModular: number;
  /** Typical resale loss attributed to the unrepaired event under ownership. */
  ownershipValueLoss?: ProvenancedValue;
  /** Whether the vehicle may keep being driven while unrepaired. */
  driveable: boolean;
}
