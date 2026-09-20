# Methodology

MML distinguishes three classes of numeric input:

- **Evidence**: values grounded in an external source or observed dataset.
- **Assumption**: values chosen to define a scenario and not presented as measured facts.
- **Derived**: values calculated from evidence and assumptions by the model.

Every canonical scenario should preserve that distinction. A publication may discuss derived values, but the model repository remains the source of the computation and provenance.

Two consequences for the fixtures:

- A curve or schedule (a residual curve, a component retention series) carries **one status for the whole series**. It is one claim about the market, not sixteen independent numbers.
- The model's own structural constants (how maintenance scales with age and distance, the share of material value held as the credit floor) live in the fixtures, not in code, so that `list_assumptions` lists every number the result rests on and the sensitivity analysis can shock it.

## What moves the result

Before a value is replaced by evidence, the model should say how much it matters. `mml sensitivity <offer>` shocks every provenanced input one at a time and ranks the change in the monthly cost under each acquisition mode; the canonical bundle carries the same table for the contracted placement. Inputs that a result does not read are listed as inert rather than omitted.

## Reproducibility

Canonical model runs should record:

- model version
- source commit
- scenario identifier and hash
- assumption-set identifier
- random seed when stochastic simulation is used
- output hashes

## Sequence

The project intentionally starts deterministic:

1. DCF primitives
2. Mobility Rate composition
3. lifecycle transitions
4. CRV and MRV
5. Agency economics
6. portfolio economics
7. sensitivity analysis
8. Monte Carlo simulation
9. MCP exposure
10. Agency experience prototype

This order is intended to make the model inspectable before it becomes interactive.
