import { isProvenancedSeries, isProvenancedValue, round, type EvidenceKind } from "./provenance.ts";

export interface SensitivityRow {
  /** Dot path of the input inside the object handed to the analysis, e.g. `finance.fleetCostOfCapital`. */
  path: string;
  kind: EvidenceKind;
  baseValue: number | number[];
  /** Change in each output when the input is shocked, in the output's own unit. */
  deltas: Record<string, number>;
  /** Sum of absolute deltas across outputs: the row's overall weight, used for ordering. */
  weight: number;
}

export interface SensitivityResult<Outputs extends Record<string, number>> {
  shock: number;
  baseline: Outputs;
  rows: SensitivityRow[];
}

/**
 * One-at-a-time sensitivity (roadmap M5): every provenanced value or series
 * inside `inputs` is shocked by `shock` (default +10%) on its own, the
 * outputs are recomputed, and the change is recorded. Ordering rows by weight
 * answers the question the evidence work needs answered first: which
 * assumptions move the result, and therefore which sources to find.
 *
 * Inputs whose shock cannot change the outputs (a value the evaluation does
 * not read) come back with zero deltas, so the table also shows what the
 * outputs do not depend on.
 */
export function oneAtATimeSensitivity<Inputs, Outputs extends Record<string, number>>(
  inputs: Inputs,
  evaluate: (inputs: Inputs) => Outputs,
  options: { shock?: number; digits?: number } = {},
): SensitivityResult<Outputs> {
  const shock = options.shock ?? 0.1;
  const digits = options.digits ?? 1;
  if (!(shock > -1) || !Number.isFinite(shock)) throw new RangeError("shock must be a finite factor above -1");
  const baseline = evaluate(inputs);
  const rows: SensitivityRow[] = [];

  for (const target of provenancedPaths(inputs)) {
    const shocked = structuredClone(inputs);
    const holder = target.path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], shocked) as Record<string, unknown>;
    if (target.series) holder.values = (holder.values as number[]).map((value) => value * (1 + shock));
    else holder.value = (holder.value as number) * (1 + shock);
    const outputs = evaluate(shocked);
    const deltas = Object.fromEntries(
      Object.keys(baseline).map((key) => [key, round(outputs[key] - baseline[key], digits)]),
    ) as Record<string, number>;
    rows.push({
      path: target.path,
      kind: target.kind,
      baseValue: target.baseValue,
      deltas,
      weight: round(Object.values(deltas).reduce((total, delta) => total + Math.abs(delta), 0), digits),
    });
  }

  rows.sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));
  return { shock, baseline, rows };
}

interface Target {
  path: string;
  kind: EvidenceKind;
  series: boolean;
  baseValue: number | number[];
}

/** Every provenanced value or series reachable from `root`, keys starting with `_` skipped as in the fixtures. */
export function provenancedPaths(root: unknown): Target[] {
  const targets: Target[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (isProvenancedValue(node)) {
      targets.push({ path, kind: node.kind, series: false, baseValue: node.value });
      return;
    }
    if (isProvenancedSeries(node)) {
      targets.push({ path, kind: node.kind, series: true, baseValue: node.values });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("_")) continue;
      walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(root, "");
  return targets;
}

/** A deep copy of `root` with the provenanced value at `path` set to `value`; the original is untouched. */
export function withProvenancedValue<T>(root: T, path: string, value: number): T {
  const copy = structuredClone(root);
  const holder = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], copy);
  if (!isProvenancedValue(holder)) throw new Error(`no provenanced value at ${path}`);
  holder.value = value;
  return copy;
}
