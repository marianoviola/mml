import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  isProvenancedSeries,
  isProvenancedValue,
  type EnergyPrices,
  type FinanceProducts,
  type InsuranceTariff,
  type ProvenancedValue,
  type RepairEventType,
  type ResidualCurves,
  type Vehicle,
  type VehicleCondition,
} from "@mml/core";

export interface Offer {
  id: string;
  vehicleId: string;
  source: "dealer" | "fleet";
  dealer: string;
  region: string;
  condition: "new" | "second-life" | "third-life";
  ageYears: number;
  odometerKm: number;
  vehicleCondition: VehicleCondition;
  price: number;
  discountFromList?: number;
  availability: "in-stock" | "order" | "after-refurbishment";
  deliveryWeeks: number;
  testDriveSlots: string[];
}

const fixturesDir = new URL("../fixtures/", import.meta.url);

function readFixture<T>(name: string): { data: T; hash: string } {
  const raw = readFileSync(new URL(name, fixturesDir), "utf8");
  return { data: JSON.parse(raw) as T, hash: createHash("sha256").update(raw).digest("hex").slice(0, 12) };
}

export interface Fixtures {
  vehicles: Vehicle[];
  offers: Offer[];
  finance: FinanceProducts;
  insurance: InsuranceTariff;
  curves: ResidualCurves;
  energy: EnergyPrices;
  repairEvents: RepairEventType[];
  hashes: Record<string, string>;
}

let cached: Fixtures | undefined;

export function loadFixtures(): Fixtures {
  if (cached) return cached;
  const vehicles = readFixture<{ vehicles: Vehicle[] }>("vehicles.json");
  const offers = readFixture<{ offers: Offer[] }>("offers.json");
  const finance = readFixture<FinanceProducts>("finance.json");
  const insurance = readFixture<InsuranceTariff>("insurance.json");
  const curves = readFixture<ResidualCurves>("residual-curves.json");
  const energy = readFixture<EnergyPrices>("energy.json");
  const repairs = readFixture<{ events: RepairEventType[] }>("repairs.json");
  cached = {
    vehicles: vehicles.data.vehicles,
    offers: offers.data.offers,
    finance: finance.data,
    insurance: insurance.data,
    curves: curves.data,
    energy: energy.data,
    repairEvents: repairs.data.events,
    hashes: {
      "vehicles.json": vehicles.hash,
      "offers.json": offers.hash,
      "finance.json": finance.hash,
      "insurance.json": insurance.hash,
      "residual-curves.json": curves.hash,
      "energy.json": energy.hash,
      "repairs.json": repairs.hash,
    },
  };
  return cached;
}

export interface AssumptionRecord {
  path: string;
  /** A single value, or the points of a curve that carries one status. */
  value: number | number[];
  kind: ProvenancedValue["kind"];
  source?: string;
  rationale?: string;
}

/** Walk every fixture and list each provenanced number, so nothing is used without a declared status. */
export function listAssumptions(fixtures: Fixtures = loadFixtures()): AssumptionRecord[] {
  const records: AssumptionRecord[] = [];
  const walk = (value: unknown, path: string) => {
    if (value && typeof value === "object") {
      if (isProvenancedValue(value)) {
        records.push({ path, value: value.value, kind: value.kind, source: value.source, rationale: value.rationale });
        return;
      }
      if (isProvenancedSeries(value)) {
        records.push({ path, value: value.values, kind: value.kind, source: value.source, rationale: value.rationale });
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (key.startsWith("_")) continue;
        walk(child, `${path}.${key}`);
      }
    }
  };
  walk(fixtures.vehicles, "vehicles");
  walk(fixtures.finance, "finance");
  walk(fixtures.insurance, "insurance");
  walk(fixtures.curves, "curves");
  walk(fixtures.energy, "energy");
  walk(fixtures.repairEvents, "repairs");
  return records;
}

/**
 * An assumption set overrides provenanced values by path, so a scenario can be
 * run central, adverse and optimistic on the same fixtures and the bundle can
 * say which set produced it. Vehicles are addressed by id: `vehicles.<id>.<path>`.
 * An override keeps the original's kind unless it changes the value, in which
 * case it becomes an assumption with the set's rationale: evidence overridden
 * is no longer evidence.
 */
export interface AssumptionSet {
  id: string;
  description: string;
  overrides: Record<string, { value: number; rationale: string }>;
}

export const assumptionSetsDir = new URL("../../../scenarios/sets/", import.meta.url);

export function loadAssumptionSet(id: string): AssumptionSet {
  const raw = readFileSync(new URL(`${id}.json`, assumptionSetsDir), "utf8");
  const set = JSON.parse(raw) as AssumptionSet;
  if (set.id !== id) throw new Error(`assumption set file ${id}.json declares id ${set.id}`);
  return set;
}

export function listAssumptionSets(): string[] {
  return readdirSync(assumptionSetsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort();
}

export function applyAssumptionSet(fixtures: Fixtures, set: AssumptionSet): Fixtures & { assumptionSet: { id: string; hash: string } } {
  const applied: Fixtures = structuredClone(fixtures);
  for (const [path, override] of Object.entries(set.overrides)) {
    const [head, ...rest] = path.split(".");
    let node: unknown;
    let remaining = rest;
    if (head === "vehicles") {
      const [id, ...vehiclePath] = rest;
      node = applied.vehicles.find((vehicle) => vehicle.id === id);
      remaining = vehiclePath;
      if (!node) throw new Error(`assumption set ${set.id}: unknown vehicle ${id} in ${path}`);
    } else if (head === "finance" || head === "insurance" || head === "curves" || head === "energy") {
      node = applied[head];
    } else {
      throw new Error(`assumption set ${set.id}: cannot override ${path}`);
    }
    for (const key of remaining) {
      node = (node as Record<string, unknown> | undefined)?.[key];
      if (node === undefined) throw new Error(`assumption set ${set.id}: no value at ${path}`);
    }
    if (!isProvenancedValue(node)) throw new Error(`assumption set ${set.id}: ${path} is not a provenanced value`);
    if (node.value !== override.value) {
      node.value = override.value;
      node.kind = "assumption";
      node.rationale = override.rationale;
      delete node.source;
    }
  }
  const hash = createHash("sha256").update(JSON.stringify(set)).digest("hex").slice(0, 12);
  return { ...applied, assumptionSet: { id: set.id, hash } };
}
