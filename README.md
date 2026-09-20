# MML

**Managed Mobility Lifecycle** is a computational research project exploring what changes when private mobility is optimised around the productive lifecycle of vehicles rather than repeated vehicle transactions.

This repository contains the model, assumptions, scenarios and interfaces used to test the MML thesis. The publication itself lives separately on marianoviola.com.

## Architecture

```text
packages/core            deterministic economics and lifecycle model
packages/data            fixtures with provenance (vehicles, placements, finance, insurance, curves, repair events)
packages/lifecycle       lifecycle graph operations and the persistent customer context
apps/cli                 command-line interface for reproducible runs
apps/mcp                 MCP adapter over the lifecycle operations, with the Agency prompt
scenarios                reference vehicles and the assumption sets (central, adverse, optimistic)
bundles                  canonical result bundles per model version, reproduced by CI
state                    customer contexts written by the MCP server (gitignored)
outputs                  scratch results (gitignored)
docs                     methodology and architecture
```

See `docs/AGENTIC.md` for the agentic layer and how to run it.

## Principles

- The model is deterministic unless a simulation explicitly introduces uncertainty.
- Inputs, assumptions and derived values remain distinguishable.
- Published result bundles are reproducible and versioned.
- The MCP server exposes the model; it does not contain economic logic.
- The publication interprets the model; it does not contain the model.
- Site builds never execute simulations.

## Initial roadmap

1. Build deterministic DCF and mobility-rate primitives.
2. Define MML-H and MML-E reference vehicles.
3. Add lifecycle transitions, CRV and MRV.
4. Add Agency and portfolio economics.
5. Add sensitivity analysis and Monte Carlo simulation.
6. Expose stable operations through CLI and MCP.
7. Generate immutable result bundles for the MML publication.
8. Build an Agency experience prototype only after the model is credible.

Status: **model 0.2.0**. The deterministic core, the fixture layer, the lifecycle
operations, sensitivity, break-even and the MCP server exist and are tested; the
€450 scenario runs end to end under three assumption sets, with the budget
tested against the fixed Mobility Rate as chapter 2.3 defines it, and its
bundles are committed under `bundles/0.2.0/`. The vehicle the scenario rests on is documented
from published sources; the other six remain assumptions with a rationale. What the
run says is in `docs/AGENTIC.md`.

## Licence

MIT. See `LICENSE`. Requires Node 24 or later (tests import TypeScript sources directly).
