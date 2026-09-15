import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type {
  FinanceProducts,
  InsuranceTariff,
  ProvenancedValue,
  RepairEventType,
  ResidualCurves,
  Vehicle,
  VehicleCondition,
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
  const repairs = readFixture<{ events: RepairEventType[] }>("repairs.json");
  cached = {
    vehicles: vehicles.data.vehicles,
    offers: offers.data.offers,
    finance: finance.data,
    insurance: insurance.data,
    curves: curves.data,
    repairEvents: repairs.data.events,
    hashes: {
      "vehicles.json": vehicles.hash,
      "offers.json": offers.hash,
      "finance.json": finance.hash,
      "insurance.json": insurance.hash,
      "residual-curves.json": curves.hash,
      "repairs.json": repairs.hash,
    },
  };
  return cached;
}

export interface AssumptionRecord {
  path: string;
  value: number;
  kind: ProvenancedValue["kind"];
  source?: string;
  rationale?: string;
}

/** Walk every fixture and list each provenanced number, so nothing is used without a declared status. */
export function listAssumptions(): AssumptionRecord[] {
  const fixtures = loadFixtures();
  const records: AssumptionRecord[] = [];
  const walk = (value: unknown, path: string) => {
    if (value && typeof value === "object") {
      const candidate = value as Partial<ProvenancedValue>;
      if (typeof candidate.value === "number" && typeof candidate.kind === "string") {
        records.push({ path, value: candidate.value, kind: candidate.kind, source: candidate.source, rationale: candidate.rationale });
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
  walk(fixtures.repairEvents, "repairs");
  return records;
}
