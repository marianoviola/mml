# Methodology

MML distinguishes three classes of numeric input:

- **Evidence**: values grounded in an external source or observed dataset.
- **Assumption**: values chosen to define a scenario and not presented as measured facts.
- **Derived**: values calculated from evidence and assumptions by the model.

Every canonical scenario should preserve that distinction. A publication may discuss derived values, but the model repository remains the source of the computation and provenance.

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
