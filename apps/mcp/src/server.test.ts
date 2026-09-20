import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.ts";

async function connect() {
  const dir = mkdtempSync(join(tmpdir(), "mml-mcp-"));
  const server = createServer(dir);
  const client = new Client({ name: "test", version: "0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    return { ok: !result.isError, value: result.isError ? text : JSON.parse(text) };
  };
  return { client, call, cleanup: async () => { await client.close(); await server.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test("the server exposes the lifecycle graph as tools, the context as a resource and the Agency as a prompt", async () => {
  const { client, cleanup } = await connect();
  try {
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(tools, [
      "advance_time", "break_even_placement", "capture_household", "get_context", "list_assumptions", "list_catalogue", "quote_placement",
      "report_event", "resolve_event", "review_continuation", "sensitivity_placement", "shortlist_placements", "sign_contract",
    ]);
    const prompts = (await client.listPrompts()).prompts.map((prompt) => prompt.name);
    assert.deepEqual(prompts, ["agency"]);
    const prompt = await client.getPrompt({ name: "agency", arguments: { customer_id: "rossi" } });
    assert.match((prompt.messages[0].content as { text: string }).text, /customer "rossi"/);
    const templates = await client.listResourceTemplates();
    assert.ok(templates.resourceTemplates.some((template) => template.uriTemplate === "mml://customers/{id}"));
  } finally {
    await cleanup();
  }
});

test("an orchestrator can walk the €450 journey through the tools and read the context back", async () => {
  const { client, call, cleanup } = await connect();
  try {
    const empty = await call("get_context", { customer_id: "rossi" });
    assert.equal(empty.value.timeline.length, 0);

    const requirement = await call("capture_household", {
      customer_id: "rossi", adults: 2, children: 2, long_journeys: true, annual_km: 20000, monthly_budget: 450,
      home_charging: false, public_charging_access: true, licence_years: 15,
    });
    assert.equal(requirement.value.mobilityClass, "family-touring");

    const shortlist = await call("shortlist_placements", { customer_id: "rossi" });
    assert.ok(shortlist.value.eligible.length >= 3);
    const cheapest = shortlist.value.eligible[0];

    const quote = await call("quote_placement", { customer_id: "rossi", offer_id: cheapest.offerId });
    assert.equal(quote.value.comparison.modes.length, 3);
    const km = quote.value.quote.withinBudget ? 20000 : quote.value.adjustments.find((a: { kind: string }) => a.kind === "distance")?.annualKm ?? 20000;

    const sensitivity = await call("sensitivity_placement", { customer_id: "rossi", offer_id: cheapest.offerId, annual_km: km });
    assert.equal(sensitivity.value.baseline.mml, quote.value.adjustments.find((a: { kind: string }) => a.kind === "distance")?.allIn ?? quote.value.quote.rate.allInMonthly.value);
    assert.ok(sensitivity.value.leading.includes("vehicle.listPrice"));
    const kinds = new Set(sensitivity.value.rows.map((row: { kind: string }) => row.kind));
    assert.ok(kinds.has("evidence") && kinds.has("assumption"), "the table tells evidence from assumption for every input that moves the quote");
    assert.equal(sensitivity.value.rows.find((row: { path: string }) => row.path === "vehicle.listPrice").kind, "evidence");

    const breakEvens = await call("break_even_placement", { customer_id: "rossi", offer_id: cheapest.offerId, annual_km: km });
    assert.equal(breakEvens.value.rows.length, 4);
    assert.ok(breakEvens.value.rows.every((row: { note: string }) => row.note.length > 0), "every break-even row says what it found, including 'none'");

    const contract = await call("sign_contract", { customer_id: "rossi", offer_id: cheapest.offerId, started_at: "2026-09-15", annual_km: km });
    assert.equal(contract.value.offerId, cheapest.offerId);

    await call("advance_time", { customer_id: "rossi", months: 12 });
    const hail = await call("report_event", { customer_id: "rossi", event_id: "hail-roof" });
    assert.equal(hail.value.assessment.state, "cosmetic");

    const review = await call("review_continuation", { customer_id: "rossi" });
    assert.ok(["continue", "refurbish", "reassign-customer", "retire-and-harvest"].includes(review.value.decision));

    const resource = await client.readResource({ uri: "mml://customers/rossi" });
    const context = JSON.parse((resource.contents[0] as { text: string }).text);
    assert.ok(context.timeline.length >= 6);
    assert.equal(context.contract.annualKm, km);
  } finally {
    await cleanup();
  }
});

test("tool errors come back as tool results, not protocol failures", async () => {
  const { call, cleanup } = await connect();
  try {
    const result = await call("shortlist_placements", { customer_id: "ghost" });
    assert.equal(result.ok, false);
    assert.match(result.value, /unknown customer/);
  } finally {
    await cleanup();
  }
});
