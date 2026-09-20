#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { listAssumptions } from "@mml/data";
import { ContextStore, LifecycleOperations } from "@mml/lifecycle";
import { agencyPrompt } from "./agency-prompt.ts";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const stateDir = process.env.MML_STATE_DIR ?? fileURLToPath(new URL("../../../state/", import.meta.url));

export function createServer(dir: string = stateDir): McpServer {
  const store = new ContextStore(dir);
  const ops = new LifecycleOperations(store);
  const server = new McpServer({ name: "mml", version: packageJson.version });

  const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
  const failure = (error: unknown) => ({
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
  });
  const guarded = <T>(run: () => T) => {
    try {
      return json(run());
    } catch (error) {
      return failure(error);
    }
  };

  const customerId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/i).describe("Customer identifier; created on first use");
  const eventIds = ops.fixtures.repairEvents.map((event) => event.id) as [string, ...string[]];

  server.registerTool(
    "get_context",
    {
      title: "Customer context",
      description: "The persistent record of one customer: household, requirement, contract, vehicle state and the timeline of every lifecycle node visited. Read it first.",
      inputSchema: { customer_id: customerId },
    },
    ({ customer_id }) => guarded(() => (store.exists(customer_id) ? store.get(customer_id) : { id: customer_id, timeline: [], note: "new customer; capture the household first" })),
  );

  server.registerTool(
    "list_catalogue",
    {
      title: "Catalogue",
      description: "Vehicles the model knows, the placements (new dealer offers and later-life fleet stock) available for each, and the repair event types it can assess. Use the ids in other tools.",
      inputSchema: {},
    },
    () =>
      guarded(() => ({
        vehicles: ops.fixtures.vehicles.map((vehicle) => ({
          id: vehicle.id, name: `${vehicle.make} ${vehicle.model}`, class: vehicle.mobilityClass, powertrain: vehicle.powertrain,
          seats: vehicle.seats, luggageLitres: vehicle.luggageLitres, listPrice: vehicle.listPrice, stage: vehicle.lifecycle.stage,
        })),
        offers: ops.fixtures.offers.map((offer) => ({
          id: offer.id, vehicleId: offer.vehicleId, source: offer.source, life: offer.condition, ageYears: offer.ageYears,
          odometerKm: offer.odometerKm, price: offer.price, availability: offer.availability, deliveryWeeks: offer.deliveryWeeks, testDriveSlots: offer.testDriveSlots,
        })),
        repairEvents: ops.fixtures.repairEvents.map((event) => ({ id: event.id, label: event.label, state: event.state })),
      })),
  );

  server.registerTool(
    "capture_household",
    {
      title: "Capture the household requirement",
      description: "Record what the household needs and can afford, and derive its mobility class, term and constraints (chapter 2.1). Required before shortlist or quote.",
      inputSchema: {
        customer_id: customerId,
        adults: z.number().int().min(1),
        children: z.number().int().min(0),
        long_journeys: z.boolean().describe("Regular journeys above ~300 km"),
        annual_km: z.number().int().min(1000),
        monthly_budget: z.number().min(50).describe("All-in monthly budget declared before quotation"),
        home_charging: z.boolean(),
        public_charging_access: z.boolean(),
        licence_years: z.number().int().min(0),
        compact_preferred: z.boolean().optional(),
        high_luggage: z.boolean().optional(),
      },
    },
    (args) =>
      guarded(() =>
        ops.captureHousehold(args.customer_id, {
          adults: args.adults, children: args.children, longJourneys: args.long_journeys, annualKm: args.annual_km,
          monthlyBudget: args.monthly_budget, homeCharging: args.home_charging, publicChargingAccess: args.public_charging_access,
          licenceYears: args.licence_years, compactPreferred: args.compact_preferred, highLuggage: args.high_luggage,
        }).requirement,
      ),
  );

  server.registerTool(
    "shortlist_placements",
    {
      title: "Shortlist eligible placements",
      description: "Every vehicle that meets the requirement, in every life the fleet can place it in, priced as a Mobility Rate and sorted cheapest first; plus the vehicles excluded and why.",
      inputSchema: { customer_id: customerId },
    },
    ({ customer_id }) =>
      guarded(() => {
        const result = ops.shortlist(customer_id);
        return {
          requirement: result.requirement,
          eligible: result.eligible.map((quote) => ({
            offerId: quote.offer.id, vehicle: `${quote.vehicle.make} ${quote.vehicle.model}`, life: quote.offer.condition,
            ageYears: quote.offer.ageYears, odometerKm: quote.offer.odometerKm, availability: quote.offer.availability,
            fixedRate: quote.rate.fixedRate.value, variableUse: quote.rate.variableUse.value, allIn: quote.rate.allInMonthly.value,
            withinBudget: quote.withinBudget, budgetGap: quote.budgetGap,
          })),
          excluded: result.excluded.map(({ vehicle, reasons }) => ({ vehicle: `${vehicle.make} ${vehicle.model}`, reasons })),
        };
      }),
  );

  server.registerTool(
    "quote_placement",
    {
      title: "Quote one placement",
      description: "Full Mobility Rate composition for one offer, the same vehicle priced under ownership, long-term rental and MML on one footing, and what would have to change if the budget is not met.",
      inputSchema: {
        customer_id: customerId,
        offer_id: z.string(),
        term_months: z.number().int().min(12).max(120).optional(),
        annual_km: z.number().int().min(1000).optional(),
      },
    },
    ({ customer_id, offer_id, term_months, annual_km }) => guarded(() => ops.quote(customer_id, offer_id, term_months, annual_km)),
  );

  server.registerTool(
    "sign_contract",
    {
      title: "Sign the mobility contract",
      description: "Place the customer in the chosen offer. Records the fixed rate, the variable-use estimate, the term, the distance allowance and the Material Capital Credit floor.",
      inputSchema: {
        customer_id: customerId,
        offer_id: z.string(),
        started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        term_months: z.number().int().min(12).max(120).optional(),
        annual_km: z.number().int().min(1000).optional(),
      },
    },
    ({ customer_id, offer_id, started_at, term_months, annual_km }) =>
      guarded(() => ops.contract(customer_id, offer_id, started_at, term_months, annual_km).contract),
  );

  server.registerTool(
    "advance_time",
    {
      title: "Let time pass",
      description: "Move the contract forward: the vehicle ages, distance accrues, the Material Capital Credit builds, scheduled refurbishments are flagged.",
      inputSchema: { customer_id: customerId, months: z.number().int().min(1).max(120), km_driven: z.number().int().min(0).optional() },
    },
    ({ customer_id, months, km_driven }) => guarded(() => {
      const context = ops.advance(customer_id, months, km_driven);
      return { vehicle: context.vehicle, contract: context.contract, latest: context.timeline.at(-1) };
    }),
  );

  server.registerTool(
    "report_event",
    {
      title: "Report a repair event",
      description: "Assess an event against the lifecycle standard: state (safety defect, maintenance shortfall, cosmetic), response, repair before replacement where the design allows, downtime, continuity, and what the same event would cost under ownership.",
      inputSchema: { customer_id: customerId, event_id: z.enum(eventIds) },
    },
    ({ customer_id, event_id }) => guarded(() => ops.reportEvent(customer_id, event_id)),
  );

  server.registerTool(
    "resolve_event",
    {
      title: "Resolve a repair event",
      description: "Mark an open event repaired and recorded in the asset ledger.",
      inputSchema: { customer_id: customerId, event_id: z.enum(eventIds) },
    },
    ({ customer_id, event_id }) => guarded(() => ops.resolveEvent(customer_id, event_id).timeline.at(-1)),
  );

  server.registerTool(
    "review_continuation",
    {
      title: "Continue, refurbish, reassign or retire?",
      description: "Decide on the fleet's money over a horizon: is the vehicle worth more repaired than harvested, and should this customer keep it or move to another fleet placement? Returns mobility, component and material retention values.",
      inputSchema: { customer_id: customerId, horizon_months: z.number().int().min(12).max(120).optional() },
    },
    ({ customer_id, horizon_months }) => guarded(() => {
      const result = ops.reviewContinuation(customer_id, horizon_months);
      return {
        ...result.assessment,
        alternative: result.alternative
          ? { offerId: result.alternative.offer.id, vehicle: `${result.alternative.vehicle.make} ${result.alternative.vehicle.model}`, life: result.alternative.offer.condition, fixedRate: result.alternative.rate.fixedRate.value }
          : undefined,
      };
    }),
  );

  server.registerTool(
    "sensitivity_placement",
    {
      title: "What moves this quote",
      description: "Shock every provenanced input one at a time (default +10%) and rank the change in the all-in monthly cost of one placement under MML, ownership and long-term rental. Use it to say which assumptions a number rests on, and which evidence would change it. Reads the context, writes nothing.",
      inputSchema: {
        customer_id: customerId,
        offer_id: z.string(),
        annual_km: z.number().int().positive().optional().describe("Defaults to the requirement's distance"),
        term_months: z.number().int().positive().optional(),
        shock: z.number().gt(-1).optional().describe("Relative shock, default 0.1"),
      },
    },
    ({ customer_id, offer_id, annual_km, term_months, shock }) =>
      guarded(() => {
        const result = ops.sensitivity(customer_id, offer_id, { annualKm: annual_km, termMonths: term_months, shock });
        return {
          offerId: result.offerId, termMonths: result.termMonths, annualKm: result.annualKm, shock: result.shock,
          baseline: result.baseline, leading: result.leading,
          rows: result.rows.filter((row) => row.weight > 0).map(({ path, kind, deltas }) => ({ path, kind, ...deltas })),
          inert: result.rows.filter((row) => row.weight === 0).map((row) => row.path),
        };
      }),
  );

  server.registerTool(
    "list_assumptions",
    {
      title: "Provenance of every number",
      description: "Every provenanced value in the fixtures with its kind (evidence, assumption, derived), source or rationale. Filter by path prefix, e.g. 'finance' or 'vehicles'.",
      inputSchema: { prefix: z.string().optional() },
    },
    ({ prefix }) => guarded(() => listAssumptions().filter((record) => !prefix || record.path.startsWith(prefix))),
  );

  server.registerResource(
    "customer",
    new ResourceTemplate("mml://customers/{id}", {
      list: () => ({ resources: store.list().map((id) => ({ uri: `mml://customers/${id}`, name: id, mimeType: "application/json" })) }),
    }),
    { title: "Customer context", description: "Persistent lifecycle context of one customer", mimeType: "application/json" },
    (uri, { id }) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(store.get(String(id)), null, 2) }] }),
  );

  server.registerResource(
    "assumptions",
    "mml://assumptions",
    { title: "Model assumptions", description: "Provenance of every fixture value", mimeType: "application/json" },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(listAssumptions(), null, 2) }] }),
  );

  server.registerPrompt(
    "agency",
    {
      title: "Act as the MML Agency",
      description: "The orchestrator brief: one continuous relationship across the lifecycle graph, every number from the model.",
      argsSchema: { customer_id: z.string().describe("Customer to act for") },
    },
    ({ customer_id }) => ({ messages: [{ role: "user", content: { type: "text", text: agencyPrompt(customer_id) } }] }),
  );

  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
