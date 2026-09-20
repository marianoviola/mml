/**
 * Every numeric input the model consumes carries its epistemic status, as
 * docs/METHODOLOGY.md requires: evidence is grounded in a source, an
 * assumption defines a scenario, a derived value is computed by the model.
 */
export type EvidenceKind = "evidence" | "assumption" | "derived";

export interface ProvenancedValue {
  value: number;
  kind: EvidenceKind;
  source?: string;
  rationale?: string;
}

/** A curve or schedule carries one status for all its points: a residual curve is one claim, not sixteen. */
export interface ProvenancedSeries {
  values: number[];
  kind: EvidenceKind;
  source?: string;
  rationale?: string;
  /** When only the first points are observed: the last index grounded in the source; the rest is extrapolation. */
  evidenceThroughIndex?: number;
}

export const isProvenancedValue = (candidate: unknown): candidate is ProvenancedValue =>
  typeof candidate === "object" && candidate !== null &&
  typeof (candidate as ProvenancedValue).value === "number" && typeof (candidate as ProvenancedValue).kind === "string";

export const isProvenancedSeries = (candidate: unknown): candidate is ProvenancedSeries =>
  typeof candidate === "object" && candidate !== null &&
  Array.isArray((candidate as ProvenancedSeries).values) && typeof (candidate as ProvenancedSeries).kind === "string";

export const evidence = (value: number, source: string): ProvenancedValue => ({
  value,
  kind: "evidence",
  source,
});

export const assumption = (value: number, rationale: string): ProvenancedValue => ({
  value,
  kind: "assumption",
  rationale,
});

export const derived = (value: number, rationale: string): ProvenancedValue => ({
  value,
  kind: "derived",
  rationale,
});

export const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
