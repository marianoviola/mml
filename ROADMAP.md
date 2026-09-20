# MML Model Roadmap

## M0 · Bootstrap

- [x] Create pnpm workspace.
- [x] Add `@mml/core`.
- [x] Add CLI bootstrap.
- [x] Reserve MCP boundary.
- [x] Add HEV and BEV reference scenarios.
- [x] Document evidence / assumption / derived-value methodology.

## M1 · Deterministic economics

- [ ] Define scenario schema and validation.
- [ ] Implement annual lifecycle cash-flow model.
- [x] Implement cost-of-capital treatment (fleet, lessor and retail loan, `packages/core/src/acquisition.ts`).
- [x] Implement Mobility Rate decomposition (`packages/core/src/mobility-rate.ts`).
- [x] Implement CRV and MRV primitives (`packages/core/src/retention.ts`).
- [x] Add unit tests and a golden scenario (`four-fifty`, hashed bundle).

## M2 · Lifecycle engine

- [x] Model lifecycle transitions as graph operations: requirement, shortlist, contract, advance, repair, continuation (`packages/lifecycle`).
- [ ] Model refurbishment events and vehicle condition beyond the scheduled provision.
- [x] Model component harvesting and material recovery in the continuation decision.
- [x] Model downtime and replacement mobility on repair events.

## M3 · Reference vehicles

- [ ] Complete MML-H assumptions and evidence.
- [ ] Complete MML-E assumptions and evidence.
- [ ] Add central, optimistic and adverse scenario sets.
- [ ] Produce ownership / leasing-NLT / MML comparisons.

## M4 · Agency and capital

- [ ] Model Agency recurring and event-based revenue.
- [ ] Model provider composition and service costs.
- [ ] Model asset company, bank and investor cash flows.
- [ ] Model insurance / risk pool exposure.

## M5 · Sensitivity and stochastic simulation

- [ ] Add break-even analysis.
- [x] One-variable sensitivity analysis (`packages/core/src/sensitivity.ts`, `mml sensitivity`, `sensitivity_placement`). Multi-variable still to come.
- [ ] Add seeded Monte Carlo simulations.
- [ ] Publish confidence bands rather than false point precision.

## M6 · CLI and MCP

- [x] CLI: `scenario four-fifty`, `assumptions`, `sensitivity`. Still to come: `simulate`, `compare`, `break-even`.
- [x] MCP: the lifecycle graph as tools (`capture_household` … `review_continuation`), `sensitivity_placement`, the customer context as a resource, the `agency` prompt. Scenario-level tools (`simulate_scenario`, `compare_scenarios`, `find_break_even`) follow the rest of M5.
- [x] Include provenance in every machine-readable result.

## M7 · Publication bundles

- [ ] Generate immutable canonical result bundles.
- [ ] Record model version, commit and scenario hashes.
- [ ] Export JSON/CSV and figure-ready datasets.
- [ ] Integrate bundles with MML Publication 0.3.0 without running simulations during site builds.

## M8 · Agency prototype

The order was revised in September 2026: the working note *Agentic MML* argued
that the lifecycle experience may become integrable before the lifecycle
industry becomes integrated, so an agentic layer was built on the deterministic
core first, with fixtures standing in for the ecosystem. See `docs/AGENTIC.md`.

- [x] Translate household needs and budget into mobility scenarios.
- [x] Show best-fit and lower-cost alternatives, including later lives of the same model.
- [x] Explain recommendation and trade-off rather than only returning a price.
- [ ] Put a real household in front of the Agency and record the transcript.
- [ ] Replace one fixture at a time with a live source (dealer stock, insurance tariff, repair pricing).
