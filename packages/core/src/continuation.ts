import { derived, round, type ProvenancedValue } from "./provenance.ts";
import type { RetentionValues } from "./retention.ts";
import type { Vehicle } from "./types.ts";

export type ContinuationDecision = "continue" | "refurbish" | "reassign-customer" | "retire-and-harvest";

export interface ContinuationAssessment {
  vehicleId: string;
  ageYears: number;
  decision: ContinuationDecision;
  pendingRepairCost: number;
  /** Chapter 4.1, the asset question: value kept in service after the repair vs value as components and material. */
  asset: {
    valueAsRepairedVehicle: ProvenancedValue;
    valueAsComponentsAndMaterial: ProvenancedValue;
    remainsMobilityAsset: boolean;
  };
  /** The placement question: the fleet's cost of keeping this customer in this vehicle vs moving them. */
  placement: {
    continueCost: ProvenancedValue;
    reassignCost: ProvenancedValue;
  };
  retention: RetentionValues;
  reasoning: string[];
}

/**
 * Chapter 3.10 and 4.1: longevity cannot become an ideology, and the
 * optimisation unit is the fleet, not the car. Two questions, answered in
 * order. First, whether the vehicle is worth more repaired than harvested.
 * Second, if it is, whether this customer should keep it or move to another
 * fleet vehicle. Both are decided on the fleet's money over one horizon.
 */
export function assessContinuation(args: {
  vehicle: Vehicle;
  retention: RetentionValues;
  pendingRepairCost: number;
  horizonMonths: number;
  /** Monthly fixed rate of this vehicle if it continues in this placement. */
  currentMonthlyFixed: number;
  /** Monthly fixed rate of the best alternative fleet placement for this customer. */
  alternativeMonthlyFixed: number;
  /** One-off cost of moving the customer: logistics, handover, records. */
  reassignmentCost: number;
}): ContinuationAssessment {
  const { vehicle, retention, pendingRepairCost, horizonMonths, currentMonthlyFixed, alternativeMonthlyFixed, reassignmentCost } = args;
  const reasoning: string[] = [];
  const life = vehicle.lifecycle;
  const remainingYears = life.structuralLifeYears.value - retention.ageYears;
  const refurbishmentDue = life.refurbishmentYears.some((year) => Math.abs(year - retention.ageYears) < 0.5);
  const softwareHorizonPassed = retention.ageYears >= life.softwareSupportHorizonYears.value;

  const repairedValue = retention.mobilityValue.value - pendingRepairCost;
  const harvestValue = retention.componentRetentionValue.value + retention.materialRetentionValue.value;
  let remainsAsset = repairedValue > harvestValue;
  if (remainsAsset && remainingYears < horizonMonths / 12) {
    remainsAsset = false;
    reasoning.push(`Only ${remainingYears.toFixed(1)} years of structural life remain, less than the ${horizonMonths}-month horizon.`);
  }
  if (remainsAsset && softwareHorizonPassed && pendingRepairCost > retention.mobilityValue.value * 0.5) {
    remainsAsset = false;
    reasoning.push("Software support has lapsed and the repair exceeds half the remaining mobility value.");
  }
  if (!remainsAsset && reasoning.length === 0) {
    reasoning.push(`Repaired, the vehicle is worth €${round(repairedValue)}; as components and material it returns €${round(harvestValue)}. The fleet harvests it.`);
  } else if (remainsAsset) {
    reasoning.push(`Repaired, the vehicle is worth €${round(repairedValue)} against €${round(harvestValue)} as components and material: it stays a mobility asset.`);
    if (harvestValue > repairedValue * 0.9) reasoning.push("The margin is under 10%: the next significant repair reopens the question.");
  }

  const continueCost = pendingRepairCost + currentMonthlyFixed * horizonMonths;
  const reassignCost = reassignmentCost + alternativeMonthlyFixed * horizonMonths;

  let decision: ContinuationDecision;
  if (!remainsAsset) {
    decision = "retire-and-harvest";
  } else if (reassignCost < continueCost) {
    decision = "reassign-customer";
    reasoning.push(`Moving the customer costs the fleet €${round(reassignCost)} over ${horizonMonths} months against €${round(continueCost)} to continue; the vehicle is repaired and placed elsewhere.`);
  } else {
    decision = refurbishmentDue ? "refurbish" : "continue";
    reasoning.push(`Continuing costs the fleet €${round(continueCost)} over ${horizonMonths} months against €${round(reassignCost)} to move the customer.`);
    if (refurbishmentDue) reasoning.push(`A scheduled refurbishment falls at year ${retention.ageYears}: fold the repair into it.`);
  }

  return {
    vehicleId: vehicle.id,
    ageYears: retention.ageYears,
    decision,
    pendingRepairCost,
    asset: {
      valueAsRepairedVehicle: derived(round(repairedValue), "mobility value − pending repair"),
      valueAsComponentsAndMaterial: derived(round(harvestValue), "component retention value + material retention value"),
      remainsMobilityAsset: remainsAsset,
    },
    placement: {
      continueCost: derived(round(continueCost), "pending repair + current fixed rate × horizon"),
      reassignCost: derived(round(reassignCost), "reassignment cost + alternative fixed rate × horizon"),
    },
    retention,
    reasoning,
  };
}
