import type { Household, MobilityClass, Vehicle } from "./types.ts";

export interface MobilityRequirement {
  mobilityClass: MobilityClass;
  seats: number;
  minLuggageLitres: number;
  annualKm: number;
  termMonths: number;
  chargingViable: boolean;
  reasoning: string[];
}

/**
 * Chapter 2.1: the offer begins with the household requirement, not a model
 * from stock. Derive the class, then the constraints an eligible vehicle has
 * to satisfy. Deterministic and explainable: every branch records why.
 */
export function deriveMobilityRequirement(household: Household): MobilityRequirement {
  const occupants = household.adults + household.children;
  const reasoning: string[] = [];
  const chargingViable = household.homeCharging || household.publicChargingAccess;

  let mobilityClass: MobilityClass;
  if (occupants >= 6 || (household.highLuggage && occupants >= 5)) {
    mobilityClass = "large-family";
    reasoning.push(`${occupants} occupants or a high luggage requirement calls for a large-family class.`);
  } else if (occupants >= 4 && household.longJourneys) {
    if (household.homeCharging) {
      mobilityClass = "family-electric";
      reasoning.push("Family capacity, regular long journeys and dependable home charging fit the family-electric class.");
    } else {
      mobilityClass = "family-touring";
      reasoning.push("Two adults, children, luggage and regular long journeys define the family-touring class.");
      if (!household.homeCharging) {
        reasoning.push("Without home charging, long-journey electric use is not dependable; the class stays powertrain-open but hybrids are favoured.");
      }
    }
  } else if (household.annualKm <= 10000 && !household.longJourneys && (household.compactPreferred || occupants <= 2)) {
    mobilityClass = "urban-compact";
    reasoning.push("Short journeys, low annual distance and compact dimensions fit the urban-compact class.");
  } else {
    mobilityClass = "compact-mixed";
    reasoning.push("Mixed urban and regional use without a large-family requirement fits the compact-mixed class.");
  }

  const termByClass: Record<MobilityClass, number> = {
    "urban-compact": 36,
    "compact-mixed": 48,
    "family-touring": 60,
    "family-electric": 60,
    "large-family": 60,
  };
  const luggageByClass: Record<MobilityClass, number> = {
    "urban-compact": 250,
    "compact-mixed": 300,
    "family-touring": 500,
    "family-electric": 500,
    "large-family": 900,
  };

  return {
    mobilityClass,
    seats: Math.max(4, occupants),
    minLuggageLitres: luggageByClass[mobilityClass],
    annualKm: household.annualKm,
    termMonths: termByClass[mobilityClass],
    chargingViable,
    reasoning,
  };
}

export interface VehicleFit {
  vehicle: Vehicle;
  fits: boolean;
  reasons: string[];
}

/** A vehicle is eligible when it meets the requirement, not when it matches the class label. */
export function assessVehicleFit(vehicle: Vehicle, requirement: MobilityRequirement, household: Household): VehicleFit {
  const reasons: string[] = [];
  if (vehicle.seats < requirement.seats) reasons.push(`Needs ${requirement.seats} seats, has ${vehicle.seats}.`);
  if (vehicle.luggageLitres < requirement.minLuggageLitres) {
    reasons.push(`Needs ${requirement.minLuggageLitres} L of luggage, has ${vehicle.luggageLitres} L.`);
  }
  if (vehicle.powertrain === "bev") {
    if (!requirement.chargingViable) reasons.push("Battery-electric without any dependable charging access.");
    else if (household.longJourneys && !household.homeCharging) {
      reasons.push("Battery-electric with regular long journeys and no home charging: viable only with a planned charging routine.");
    }
  }
  const classRank: Record<Vehicle["mobilityClass"], number> = {
    "urban-compact": 0,
    "compact-mixed": 1,
    "family-touring": 2,
    "family-electric": 2,
    "large-family": 3,
  };
  if (classRank[vehicle.mobilityClass] > classRank[requirement.mobilityClass] + 1) {
    reasons.push("Larger class than the requirement; capacity the household would pay for without using.");
  }
  return { vehicle, fits: reasons.length === 0, reasons };
}
