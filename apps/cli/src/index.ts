#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listAssumptions, loadFixtures } from "@mml/data";
import { FOUR_FIFTY_HOUSEHOLD, placementSensitivity, runFourFiftyScenario } from "@mml/lifecycle";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const help = `MML CLI ${version}

Commands:
  scenario four-fifty [--state <dir>] [--out <file>]   Run the €450 journey end to end and write a reproducible bundle
  assumptions [prefix]                                 List every provenanced value the model consumes
  sensitivity <offer-id> [--km <n>] [--term <months>] [--shock <factor>] [--out <file>]
                                                       Shock every provenanced input one at a time and rank what moves the quote
  help
`;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const [command = "help", ...rest] = process.argv.slice(2);

if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(help);
} else if (command === "assumptions") {
  const prefix = rest[0];
  for (const record of listAssumptions().filter((candidate) => !prefix || candidate.path.startsWith(prefix))) {
    const shown = Array.isArray(record.value) ? `[${record.value.length} pts]` : String(record.value);
    process.stdout.write(`${record.kind.padEnd(10)} ${shown.padStart(9)}  ${record.path}\n    ${record.source ?? record.rationale ?? ""}\n`);
  }
} else if (command === "sensitivity" && rest[0]) {
  const fixtures = loadFixtures();
  const offer = fixtures.offers.find((candidate) => candidate.id === rest[0]);
  if (!offer) {
    process.stderr.write(`Unknown offer: ${rest[0]}. Known: ${fixtures.offers.map((candidate) => candidate.id).join(", ")}\n`);
    process.exit(1);
  }
  const number = (name: string) => (flag(rest, name) === undefined ? undefined : Number(flag(rest, name)));
  const result = placementSensitivity(fixtures, {
    offer,
    household: FOUR_FIFTY_HOUSEHOLD,
    annualKm: number("--km"),
    termMonths: number("--term"),
    shock: number("--shock"),
  });
  const out = flag(rest, "--out");
  if (out) {
    mkdirSync(new URL(".", `file://${out}`), { recursive: true });
    writeFileSync(out, JSON.stringify({ modelVersion: `${version}+${commit()}`, fixtureHashes: fixtures.hashes, household: FOUR_FIFTY_HOUSEHOLD, ...result }, null, 2) + "\n");
  }
  const b = result.baseline;
  process.stdout.write(`${offer.id}: ${result.termMonths} months, ${result.annualKm} km/yr; all-in €/month: MML ${b.mml}, ownership ${b.ownership}, long-term rental ${b.longTermRental}\n`);
  process.stdout.write(`Δ €/month for +${Math.round(result.shock * 100)}% on each input, heaviest first\n\n`);
  process.stdout.write(`${"input".padEnd(46)} ${"kind".padEnd(10)} ${"MML".padStart(7)} ${"own".padStart(7)} ${"NLT".padStart(7)}\n`);
  const signed = (value: number) => (value > 0 ? "+" : "") + value.toFixed(1);
  for (const row of result.rows) {
    if (row.weight === 0) continue;
    process.stdout.write(`${row.path.padEnd(46)} ${row.kind.padEnd(10)} ${signed(row.deltas.mml).padStart(7)} ${signed(row.deltas.ownership).padStart(7)} ${signed(row.deltas.longTermRental).padStart(7)}\n`);
  }
  const inert = result.rows.filter((row) => row.weight === 0).length;
  if (inert) process.stdout.write(`\n${inert} input(s) do not move this quote.\n`);
  process.stdout.write(`\nLeading: ${result.leading.join(", ")}\n`);
  if (out) process.stdout.write(`Written to ${out}\n`);
} else if (command === "scenario" && rest[0] === "four-fifty") {
  const stateDir = flag(rest, "--state") ?? `${root}outputs/state-four-fifty`;
  const out = flag(rest, "--out") ?? `${root}outputs/scenario-four-fifty.json`;
  const bundle = { ...runFourFiftyScenario({ stateDir, modelVersion: `${version}+${commit()}` }) };
  mkdirSync(new URL(".", `file://${out}`), { recursive: true });
  writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");
  for (const step of bundle.steps) {
    process.stdout.write(`\n[${step.node}] ${step.title}\n`);
    if (Array.isArray(step.output) && step.output.every((line) => typeof line === "string")) {
      for (const line of step.output as string[]) process.stdout.write(`  ${line}\n`);
    } else if (step.node === "shortlist") {
      const shortlist = step.output as { eligible: Array<{ offer: string; vehicle: string; life: string; fixedRate: number; variableUse: number; allIn: number; withinBudget: boolean }> };
      for (const quote of shortlist.eligible) {
        process.stdout.write(`  ${quote.withinBudget ? "✓" : "·"} ${quote.vehicle}, ${quote.life}: fixed €${quote.fixedRate} + use €${quote.variableUse} = €${quote.allIn}\n`);
      }
    } else if (step.node === "comparison" && (step.output as { modes?: unknown }).modes) {
      const comparison = step.output as { modes: Array<{ mode: string; allIn: number }> | Array<[string, number]>; adjustments?: Array<{ note: string }>; allInAtDeclaredDistance?: number; contractedAnnualKm?: number };
      for (const mode of comparison.modes) {
        const [name, value] = Array.isArray(mode) ? mode : [mode.mode, mode.allIn];
        process.stdout.write(`  ${String(name).padEnd(18)} €${value}/month all-in\n`);
      }
      for (const adjustment of comparison.adjustments ?? []) process.stdout.write(`  → ${adjustment.note}\n`);
    } else if (step.node === "comparison") {
      const answer = step.output as { allInAtDeclaredDistance: number; withinBudget: boolean; adjustments: Array<{ note: string }>; contractedAnnualKm: number };
      process.stdout.write(`  €${answer.allInAtDeclaredDistance}/month at the declared distance; within budget: ${answer.withinBudget}\n`);
      for (const adjustment of answer.adjustments) process.stdout.write(`  → ${adjustment.note}\n`);
      process.stdout.write(`  contracted at ${answer.contractedAnnualKm} km/yr\n`);
    } else if (step.node === "repair") {
      const repair = step.output as { assessment: { state: string; chosen: string; chosenCost: { value: number }; savingVersusAssembly: { value: number } }; continuity: string; ownershipContrast: string };
      process.stdout.write(`  ${repair.assessment.state} → ${repair.assessment.chosen} at €${repair.assessment.chosenCost.value}${repair.assessment.savingVersusAssembly.value ? ` (saves €${repair.assessment.savingVersusAssembly.value})` : ""}\n  ${repair.continuity}\n  ${repair.ownershipContrast}\n`);
    } else if (step.node === "continuation") {
      const continuation = step.output as { decision: string; reasoning: string[] };
      process.stdout.write(`  ${continuation.decision}\n`);
      for (const line of continuation.reasoning) process.stdout.write(`  ${line}\n`);
    } else if (step.node === "ownership") {
      const ownership = step.output as { vehicle: { ageYears: number; odometerKm: number }; contract: { materialCapitalCredit: number } };
      process.stdout.write(`  vehicle ${ownership.vehicle.ageYears} years, ${ownership.vehicle.odometerKm} km; Material Capital Credit €${ownership.contract.materialCapitalCredit}\n`);
    } else if (step.node === "sensitivity") {
      const sensitivity = step.output as { baseline: { mml: number }; leading: string[]; rows: Array<{ path: string; mml: number }> };
      process.stdout.write(`  baseline MML €${sensitivity.baseline.mml}/month; leading inputs: ${sensitivity.leading.join(", ")}\n`);
      for (const row of sensitivity.rows.slice(0, 5)) process.stdout.write(`  ${row.path.padEnd(44)} ${row.mml > 0 ? "+" : ""}${row.mml.toFixed(1)}\n`);
    } else if (step.node === "requirement") {
      const requirement = step.output as { mobilityClass: string; termMonths: number; reasoning: string[] };
      process.stdout.write(`  ${requirement.mobilityClass}, ${requirement.termMonths} months\n`);
      for (const line of requirement.reasoning) process.stdout.write(`  ${line}\n`);
    }
  }
  process.stdout.write(`\nBundle ${bundle.outputHash} (model ${bundle.modelVersion}) written to ${out}\n`);
} else {
  process.stderr.write(`Unknown command: ${command} ${rest.join(" ")}\n\n${help}`);
  process.exit(1);
}
