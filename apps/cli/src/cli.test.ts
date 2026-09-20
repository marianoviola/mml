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
    assert.equal(Object.keys(bundle.fixtureHashes).length, 6);
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
  assert.match(stdout, /MML 428/);
  assert.match(stdout, /vehicle\.listPrice\s+assumption\s+\+\d/);
  assert.match(stdout, /Leading: /);
  assert.throws(() => execFileSync("node", [entry, "sensitivity", "off-nope"], { stdio: "pipe" }));
});
