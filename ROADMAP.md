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
- [ ] Implement cost-of-capital treatment.
- [ ] Implement Mobility Rate decomposition.
- [ ] Implement CRV and MRV primitives.
- [ ] Add unit tests and golden reference cases.

## M2 · Lifecycle engine

- [ ] Model lifecycle transitions: deploy, maintain, refurbish, reassign, retire.
- [ ] Model refurbishment events and vehicle condition.
- [ ] Model component harvesting and material recovery.
- [ ] Model downtime and replacement mobility.

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
- [ ] Add one-variable and multi-variable sensitivity analysis.
- [ ] Add seeded Monte Carlo simulations.
- [ ] Publish confidence bands rather than false point precision.

## M6 · CLI and MCP

- [ ] Implement CLI commands: `simulate`, `compare`, `break-even`, `assumptions`.
- [ ] Implement MCP tools: `simulate_scenario`, `compare_scenarios`, `find_break_even`, `get_assumptions`.
- [ ] Include provenance in every machine-readable result.

## M7 · Publication bundles

- [ ] Generate immutable canonical result bundles.
- [ ] Record model version, commit and scenario hashes.
- [ ] Export JSON/CSV and figure-ready datasets.
- [ ] Integrate bundles with MML Publication 0.3.0 without running simulations during site builds.

## M8 · Agency prototype

- [ ] Build only after M1-M7 are credible.
- [ ] Translate household needs and budget into mobility scenarios.
- [ ] Show best-fit, lower-cost and higher-comfort alternatives.
- [ ] Explain recommendation and uncertainty rather than only returning a price.
