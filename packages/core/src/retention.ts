import { derived, round, type ProvenancedValue } from "./provenance.ts";
import type { ResidualCurves, Vehicle, VehicleCondition } from "./types.ts";

export interface RetentionValues {
  ageYears: number;
  odometerKm: number;
  condition: VehicleCondition;
  /** Value of the vehicle as mobility: what it is worth kept in service. */
  mobilityValue: ProvenancedValue;
  /** Chapter 2.3: productive value remaining in recoverable systems. */
  componentRetentionValue: ProvenancedValue;
  /** Net value after recovery and processing costs. */
  materialRetentionValue: ProvenancedValue;
  /** Chapter 2.5: the floor a Material Capital Credit can be linked to. */
  materialCapitalFloor: ProvenancedValue;
}

function interpolate(curve: number[], age: number): number {
  if (age <= 0) return curve[0];
  const last = curve.length - 1;
  if (age >= last) return curve[last];
  const lower = Math.floor(age);
  const upper = lower + 1;
  return curve[lower] + (curve[upper] - curve[lower]) * (age - lower);
}

/**
 * Chapter 4 hierarchy: Material Capital → Component Capital → Mobility
 * Capital. Each level is estimated on its own so the model can say which
 * one a decision is really trading.
 */
export function estimateRetention(
  vehicle: Vehicle,
  curves: ResidualCurves,
  ageYears: number,
  odometerKm: number,
  condition: VehicleCondition,
): RetentionValues {
  const list = vehicle.listPrice.value;
  const expectedKm = curves.referenceAnnualKm.value * ageYears;
  const kmAdjustment = 1 - (curves.kmAdjustmentPer5000.value * (odometerKm - expectedKm)) / 5000;
  const boundedKm = Math.min(1.1, Math.max(0.6, kmAdjustment));
  const conditionAdjustment = curves.conditionAdjustment[condition].value;

  const mobility = list * interpolate(curves.curves[vehicle.residualCurve].values, ageYears) * boundedKm * conditionAdjustment;
  const components = list * interpolate(curves.componentRetention.values, ageYears) * (condition === "poor" ? 0.85 : 1);
  const material = vehicle.kerbMassKg.value * curves.materialValuePerKg.value;

  return {
    ageYears,
    odometerKm,
    condition,
    mobilityValue: derived(round(mobility), "list price × age curve × distance adjustment × condition"),
    componentRetentionValue: derived(round(components), "list price × component retention curve"),
    materialRetentionValue: derived(round(material), "kerb mass × net recoverable value per kg"),
    materialCapitalFloor: derived(round(material * curves.materialCapitalFloorShare.value), `${round(curves.materialCapitalFloorShare.value * 100)}% of material retention value, held as the credit floor`),
  };
}
