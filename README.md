# MML

**Managed Mobility Lifecycle** is a computational research project exploring what changes when private mobility is optimised around the productive lifecycle of vehicles rather than repeated vehicle transactions.

This repository contains the model, assumptions, scenarios and interfaces used to test the MML thesis. The publication itself lives separately on marianoviola.com.

## Architecture

```text
packages/core            deterministic economics and lifecycle model
apps/cli                 command-line interface for reproducible runs
apps/mcp                 MCP adapter over the core model
apps/agency-prototype    future experience prototype
research                 assumptions, datasets and source notes
scenarios                canonical MML-H / MML-E and customer scenarios
outputs                   generated canonical result bundles
docs                      methodology and architecture
```

## Principles

- The model is deterministic unless a simulation explicitly introduces uncertainty.
- Inputs, assumptions and derived values remain distinguishable.
- Published result bundles are reproducible and versioned.
- The MCP server exposes the model; it does not contain economic logic.
- The publication interprets the model; it does not contain the model.
- Site builds never execute simulations.

## Agentic MML

`agentic-mml/` is a separate, related experiment, not part of the MML model above. Where MML asks what a lifecycle-native mobility system would look like if the industry restructured around it, Agentic MML asks whether a persistent orchestrator coordinating specialised tools per domain (OEM, dealer, finance, insurance, commerce, maintenance, resale) can deliver that experience today, over existing fragmented systems, reframing the funnel as a graph rather than a linear sequence. It is experiential and additive: it does not replace, depend on, or restructure the DCF/Monte Carlo/CLI/MCP/Agency work above. See [`notes/mml-agentic-lifecycle.md`](notes/mml-agentic-lifecycle.md) for the full working note.

## Initial roadmap

1. Build deterministic DCF and mobility-rate primitives.
2. Define MML-H and MML-E reference vehicles.
3. Add lifecycle transitions, CRV and MRV.
4. Add Agency and portfolio economics.
5. Add sensitivity analysis and Monte Carlo simulation.
6. Expose stable operations through CLI and MCP.
7. Generate immutable result bundles for the MML publication.
8. Build an Agency experience prototype only after the model is credible.

Status: **research bootstrap**.
