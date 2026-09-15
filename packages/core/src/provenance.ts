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
