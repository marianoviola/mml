# Published-series alignment

## Purpose and source boundary

*The Lifecycle Transition* is published separately in `marianoviola/website`.
The series defines concepts and editorial claims; this repository contains the
deterministic model, provenance, scenarios and reproducible bundles. Neither
repository copies the other. A model change does not alter published prose; a
published conceptual change does not silently alter a bundle.

The first five parts are public as of October 2026. This document is the
release contract between their published meaning and model 0.2.0.

## Current contract

| Published part | Model status | What MML may say today | What remains outside the model |
| --- | --- | --- | --- |
| 1. *The €450 question* | Implemented for the reference household | The fixed Mobility Rate is tested against €450, with energy separate; central, adverse and optimistic bundles expose the trade-off. | The household is a declared scenario, not a population estimate or a real customer quotation. |
| 2. *The lifecycle is the product* | Implemented in the reference scenario | Mobility Rate, estimated variable use, contract term, maintenance/insurance allowances, lifecycle transitions and a separately disclosed Material Capital Credit are represented. | Contract enforceability, provider networks, customer credit custody and public-support outcomes are not represented. |
| 3. *Designing the asset* | Partial | Condition, repair states, continuation and replacement-mobility outcomes can be evaluated for the fixtures. | Configurations, technical documentation, certified retrofit, software support, type approval and engineering liability are not modelled. |
| 4. *Three forms of capital* | Partial | Mobility, Component and Material Retention Values are distinct; continuation and harvesting decisions retain the highest viable state in the scenario. | Component identity, custody, recovery rights, independent condition evidence, physical destination and Material Bank operations are not modelled. |
| 5. *When things go wrong* | Partial | Fixture-backed repair events, scenario replacement mobility and continuation decisions can be explored. | Insurance settlement, custody, component-level flows, independent assessment, provider accountability, appeal, cross-border recovery and customer-credit adjustment are not modelled. |

The terms above are definitions, not market prices. A used-market price, a
customer Material Capital Credit and a modelled retention value must never be
substituted for one another.

## Published Part 5: operational failure cases

Part 5, *When things go wrong*, separates the customer's restoration of
mobility from the damaged asset's repair, reassignment or retirement; it also
sets out the evidence, accountable roles and contestable decisions that a
credible lifecycle response would require.

MML has limited, fixture-backed primitives that are relevant to this question:
it can record a repair event, choose a modelled repair response, assign
replacement mobility in the scenario and compare continuation with retention
values. Those operations do **not** implement insurance settlement, custody,
component-level physical double-entry bookkeeping, independent condition or
safety review, repairer/provider accountability, appeal, cross-border
recovery, or Material Capital Credit adjustment. Scenario output is therefore
an input to a later governed process, not a claim decision or a service
promise.

## Publication gates

Before a later chapter or a model release makes a shared claim:

1. Record whether the claim is conceptual, evidence-backed, an assumption or
   model-derived.
2. Add the corresponding fixture provenance, deterministic operation and test
   before treating the claim as calculated.
3. Regenerate a versioned bundle and record its model version, commit,
   assumption set and fixture hashes.
4. Update `docs/PUBLICATION-SYNC.md` with any changed perimeter, erratum or
   limitation. Published prose changes only through the Website repository.
5. Keep Agentic MML claims separate: an MCP interface may expose a model, but
   it does not demonstrate a governed cross-provider orchestration system.

## Next alignment frontier

Parts 5 and 6 should not be treated as already implemented. For Part 5, the
next model questions are the roles, ledgers, independent checks and provider
economics required to test responsibility when the lifecycle breaks. For Part
6, they concern how an Agency assembles a mobility outcome without assuming
providers' authority. Agentic MML is a later experience-and-governance
experiment over that foundation.
