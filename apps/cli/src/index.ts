#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listAssumptions } from "@mml/data";
import { runFourFiftyScenario } from "@mml/lifecycle";

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
    process.stdout.write(`${record.kind.padEnd(10)} ${String(record.value).padStart(9)}  ${record.path}\n    ${record.source ?? record.rationale ?? ""}\n`);
  }
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
