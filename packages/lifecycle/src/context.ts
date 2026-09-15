import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Household, MobilityRequirement, Placement, VehicleCondition } from "@mml/core";

/** Nodes of the lifecycle graph. Any of them can be an entry point (working note: from funnel to graph). */
export type LifecycleNode =
  | "discovery"
  | "requirement"
  | "shortlist"
  | "comparison"
  | "contract"
  | "ownership"
  | "service"
  | "repair"
  | "continuation"
  | "reassignment"
  | "exit";

export interface TimelineEntry {
  at: string;
  node: LifecycleNode;
  summary: string;
  data?: unknown;
}

export interface Contract {
  offerId: string;
  vehicleId: string;
  placement: Placement;
  termMonths: number;
  annualKm: number;
  startedAt: string;
  monthsElapsed: number;
  fixedRate: number;
  variableUseEstimate: number;
  /** Chapter 2.5: portable, auditable balance linked to the material floor. */
  materialCapitalCredit: number;
  materialCapitalFloor: number;
}

export interface VehicleState {
  ageYears: number;
  odometerKm: number;
  condition: VehicleCondition;
  /** Repair event ids reported and not yet resolved. */
  openEvents: string[];
}

export interface CustomerContext {
  id: string;
  createdAt: string;
  household?: Household;
  requirement?: MobilityRequirement;
  shortlist?: string[];
  contract?: Contract;
  vehicle?: VehicleState;
  timeline: TimelineEntry[];
}

/**
 * The persistent customer record. One JSON file per customer so the
 * context survives sessions, runtimes and orchestrators: continuity of
 * relationship is the point, not a feature of any one agent.
 */
export class ContextStore {
  private readonly dir: string;
  private readonly clock: () => Date;

  constructor(dir: string, clock: () => Date = () => new Date()) {
    this.dir = dir;
    this.clock = clock;
    mkdirSync(dir, { recursive: true });
  }

  private path(id: string): string {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) throw new RangeError(`invalid customer id: ${id}`);
    return join(this.dir, `${id}.json`);
  }

  list(): string[] {
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -5));
  }

  exists(id: string): boolean {
    return existsSync(this.path(id));
  }

  get(id: string): CustomerContext {
    if (!this.exists(id)) throw new Error(`unknown customer: ${id}`);
    return JSON.parse(readFileSync(this.path(id), "utf8")) as CustomerContext;
  }

  getOrCreate(id: string): CustomerContext {
    if (this.exists(id)) return this.get(id);
    const context: CustomerContext = { id, createdAt: this.clock().toISOString(), timeline: [] };
    this.save(context);
    return context;
  }

  save(context: CustomerContext): void {
    writeFileSync(this.path(context.id), JSON.stringify(context, null, 2) + "\n");
  }

  append(context: CustomerContext, node: LifecycleNode, summary: string, data?: unknown): CustomerContext {
    context.timeline.push({ at: this.clock().toISOString(), node, summary, data });
    this.save(context);
    return context;
  }
}
