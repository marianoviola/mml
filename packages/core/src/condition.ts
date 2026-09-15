import { derived, round, type ProvenancedValue } from "./provenance.ts";
import type { ConditionState, RepairEventType, Vehicle } from "./types.ts";

export type LifecycleResponse = "intervene" | "correct" | "local-repair" | "accept";

export interface RepairAssessment {
  eventId: string;
  state: ConditionState;
  /** Chapter 3.8: what the lifecycle standard requires for this state. */
  response: LifecycleResponse;
  /** Chapter 3.6: repair before replacement, where the design allows it. */
  chosen: "modular-repair" | "assembly-replacement";
  chosenCost: ProvenancedValue;
  alternativeCost?: ProvenancedValue;
  savingVersusAssembly: ProvenancedValue;
  downtimeDays: number;
  /** Chapter 2.2: continuity when the vehicle changes. */
  replacementMobilityRequired: boolean;
  ownershipValueLoss?: ProvenancedValue;
  reasoning: string[];
}

export function assessRepair(vehicle: Vehicle, event: RepairEventType): RepairAssessment {
  const reasoning: string[] = [];
  const response: LifecycleResponse =
    event.state === "safety-defect" ? "intervene"
    : event.state === "maintenance-shortfall" ? "correct"
    : event.modularRepairCost ? "local-repair" : "accept";
  reasoning.push(
    event.state === "safety-defect"
      ? "A safety defect requires intervention before the vehicle continues in service."
      : event.state === "maintenance-shortfall"
        ? "A maintenance shortfall is corrected and recorded; it may indicate neglect."
        : "Cosmetic evidence of normal use is mitigated or locally repaired, not treated as a defect.",
  );

  const modularAvailable =
    event.modularRepairCost !== undefined && (!event.requiresModularLighting || vehicle.lifecycle.modularLighting);
  if (event.requiresModularLighting && !vehicle.lifecycle.modularLighting && event.modularRepairCost) {
    reasoning.push("The lamp is a sealed assembly on this model line: the lens cannot be replaced on its own, so the whole unit is the repair unit.");
  }
  const chosen = modularAvailable ? "modular-repair" : "assembly-replacement";
  const chosenCost = modularAvailable ? event.modularRepairCost!.value : event.assemblyReplacementCost.value;
  const saving = event.assemblyReplacementCost.value - chosenCost;
  if (modularAvailable) {
    reasoning.push(`Modular repair at €${chosenCost} preserves the assembly worth €${event.assemblyReplacementCost.value}.`);
  }
  const downtime = modularAvailable ? event.downtimeDaysModular : event.downtimeDaysAssembly;
  const replacementRequired = !event.driveable || downtime > 1;
  if (replacementRequired) reasoning.push(`${downtime} day(s) off the road: the continuity response assigns replacement mobility.`);

  return {
    eventId: event.id,
    state: event.state,
    response,
    chosen,
    chosenCost: derived(chosenCost, chosen),
    alternativeCost: modularAvailable ? event.assemblyReplacementCost : undefined,
    savingVersusAssembly: derived(round(saving), "assembly replacement cost − chosen repair cost"),
    downtimeDays: downtime,
    replacementMobilityRequired: replacementRequired,
    ownershipValueLoss: event.ownershipValueLoss,
    reasoning,
  };
}
