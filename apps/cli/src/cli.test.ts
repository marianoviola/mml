import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

test("the CLI runs the €450 scenario and writes a bundle with provenance and hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "mml-cli-"));
  try {
    const out = join(dir, "bundle.json");
    const stdout = execFileSync("node", [entry, "scenario", "four-fifty", "--state", join(dir, "state"), "--out", out]).toString();
    assert.match(stdout, /\[requirement\]/);
    assert.match(stdout, /\[continuation\]/);
    const bundle = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(bundle.scenario, "four-fifty");
    assert.equal(Object.keys(bundle.fixtureHashes).length, 7);
    assert.match(bundle.outputHash, /^[0-9a-f]{16}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("assumptions lists provenance and unknown commands fail", () => {
  const stdout = execFileSync("node", [entry, "assumptions", "finance"]).toString();
  assert.match(stdout, /assumption.*finance\.fleetCostOfCapital/);
  assert.throws(() => execFileSync("node", [entry, "nope"], { stdio: "pipe" }));
});

test("sensitivity ranks what moves a placement and rejects unknown offers", () => {
  const stdout = execFileSync("node", [entry, "sensitivity", "off-corolla-fleet-6y", "--km", "12500"]).toString();
  assert.match(stdout, /all-in €\/month: MML \d+, ownership \d+, long-term rental \d+/);
  assert.match(stdout, /vehicle\.listPrice\s+evidence\s+\+\d/);
  assert.match(stdout, /Leading: /);
  assert.throws(() => execFileSync("node", [entry, "sensitivity", "off-nope"], { stdio: "pipe" }));
});

test("bundles writes one bundle per assumption set, the CSV tables and a manifest with hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "mml-bundles-"));
  try {
    const stdout = execFileSync("node", [entry, "bundles", "--dir", dir]).toString();
    assert.match(stdout, /3 bundles, 3 tables, manifest [0-9a-f]{16}/);
    const manifest = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    assert.deepEqual(manifest.bundles.map((bundle: { set: string }) => bundle.set), ["adverse", "central", "optimistic"]);
    const central = JSON.parse(readFileSync(join(dir, "four-fifty.central.json"), "utf8"));
    assert.equal(central.outputHash, manifest.bundles[1].outputHash);
    const modes = readFileSync(join(dir, "modes.csv"), "utf8");
    assert.match(modes, /^"set","placement","mode","fixed","variable","allIn"\n/);
    assert.ok(modes.includes('"adverse"') && modes.includes('"optimistic"'), "the tables stack every set");
    assert.throws(() => execFileSync("node", [entry, "scenario", "four-fifty", "--set", "nope", "--state", join(dir, "s"), "--out", join(dir, "x.json")], { stdio: "pipe" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
