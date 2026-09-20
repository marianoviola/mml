# Agentic MML

The working note asked one question: can an agent deliver the experience of a
lifecycle-native automotive model before the automotive system itself has
changed? This document describes the first stone laid to test it.

## What was built

A Model Context Protocol server that exposes the MML lifecycle as a graph of
operations, backed by a deterministic model and a persistent customer
context. Any orchestrating agent that speaks MCP (Claude Code, Claude
Desktop, or another runtime) can act as the Agency of chapter 6: hold one
relationship with a household across discovery, requirement, shortlist,
comparison, contract, ownership, service, repair, continuation and
reassignment, with every number coming from the model.

```text
packages/core        economics: mobility class, Mobility Rate, three acquisition modes,
                     retention values (mobility / component / material), repair standard,
                     continuation decision
packages/data        fixtures with provenance: vehicles, placements, finance, insurance,
                     residual curves, repair events
packages/lifecycle   the graph operations and the customer context store
apps/mcp             MCP adapter: tools, resources, the Agency prompt
apps/cli             the same operations without a language model: `mml scenario four-fifty`
```

The README's principle holds: the MCP layer contains no economic logic. Every
tool is a thin call into `@mml/lifecycle`, which composes `@mml/core` over
`@mml/data` and writes to the context.

## From funnel to graph

The note's central move is to model the automotive funnel as a graph. The
server does this literally: each tool is a node, the customer context is the
edge that connects them, and any node can be an entry point.

| Node | Tool | Chapter |
| --- | --- | --- |
| requirement | `capture_household` | 2.1, the household requirement before any model from stock |
| shortlist | `shortlist_placements` | 2.6, one vehicle, several lives: new dealer offers and later-life fleet stock priced on one footing |
| comparison | `quote_placement` | 2.3, fixed rate plus variable use; ownership, long-term rental and MML on one footing |
| contract | `sign_contract` | 2.5, the Material Capital Credit floor recorded at signature |
| ownership | `advance_time` | 2.7, the credit builds, refurbishments come due |
| repair | `report_event`, `resolve_event` | 3.6 and 3.8, repair before replacement; safety defect, maintenance shortfall, cosmetic |
| continuation | `review_continuation` | 3.10 and 4.1, the Ship of Theseus, decided on the fleet's money |
| context | `get_context`, `mml://customers/{id}` | the relationship itself |
| provenance | `list_assumptions`, `mml://assumptions` | docs/METHODOLOGY.md |
| what moves it | `sensitivity_placement` | not a node: every provenanced input shocked one at a time, so the Agency can say what a number rests on |
| what would have to be true | `break_even_placement` | not a node: the distance, structural life, cost of capital or consumption factor at which the answer changes, or "none" |

The `agency` prompt is the orchestrator's brief. It tells the hosting agent to
start from the requirement, to quote only what a tool returned, to name the
kind of every number that matters, to show what each mode charges for
rather than claim MML is cheaper, and to record every step.

## Running it

```bash
npx pnpm@10.15.0 install          # Node >= 24
npx pnpm@10.15.0 -r build
npx pnpm@10.15.0 -r test          # 30 tests: core, fixtures, scenario, MCP round-trip, CLI

node apps/cli/dist/index.js scenario four-fifty --set adverse       # the journey without a language model, under one assumption set
node apps/cli/dist/index.js assumptions energy                      # provenance of every number
node apps/cli/dist/index.js sensitivity off-corolla-fleet-6y        # what moves the €590
node apps/cli/dist/index.js break-even off-corolla-new-mi           # what would have to be true
node apps/cli/dist/index.js bundles                                 # the canonical bundles under bundles/<version>/
```

`.mcp.json` at the repository root registers the server for Claude Code.
Open the repository in Claude Code, run `/mcp` to confirm `mml` is
connected, then invoke the `agency` prompt with a customer id and ask the
€450 question. Customer records persist under `state/` as one JSON file
each, so a conversation can stop and resume in another session or runtime.

## What the run says, model 0.2.0

The scenario runs Part 1's household, two adults, two children, regular long
journeys, 20,000 km a year, no home charging, €450 a month, through the
whole graph, under three assumption sets (`scenarios/sets/`). The budget is
tested as chapter 2.3 defines the product: against the fixed Mobility Rate,
with energy estimated and shown beside it. The Corolla Touring Sports the
scenario rests on is documented from Toyota Motor Italia's MY26 price list
and maintenance tariff, MIMIT fuel prices, IVASS liability premiums and 77
used-market asking prices; the rest of the fixtures remain assumptions with
a rationale. The canonical bundles are in `bundles/0.2.0/`. Findings,
central set:

- **€450 buys the family-touring class in its third life, not new.** The
  third-life Corolla, six years and 112,000 km, is €435 a month fixed, of
  which €18 is the contribution that builds the Material Capital Credit;
  with estimated fuel at 20,000 km the household's expected total is €607.
  The second life is €489 fixed, the new vehicle €600. Nothing had to give;
  the contract is at the declared distance. On Part 1's statistical
  envelope (expected total less insurance and finance) the same placement
  is €494, against Italy's €339 and the six-country average of €476.
- **MML as priced here costs more than long-term rental on the same
  vehicle: new, €772 against €696 all-in; third life, €607 against €525.**
  The rental is on the same footing, with the deductibles and the return
  settlement the renter carries shown as expected values, and €18 of the
  MML figure returns to the household as credit. Break-even says what
  would have to be true for the gap to close on the new vehicle: a
  structural life of 23 years against the central 15, or fleet capital at
  1.7% against 5%, or a first-life consumption factor of 0.77 against 1.2;
  on the third life, 27 years of life or a later-life factor of 0.37. Under
  the optimistic set the new vehicle is at parity, €664 each. What MML
  charges for is in the breakdown; the case that it is worth €60–80 a
  month is the publication's to make, not the rate's.
- **The answer moves with the evidence, not only with the hypotheses.** At
  +10% per input on the contracted placement: list price, the residual
  curve and its condition factor (+€24 each), fuel price, real-use uplift
  and WLTP consumption (+€17 each), structural life (−€21), the later-life
  consumption factor (+€13). Three of the six heaviest inputs are now
  evidence with a source; the two that are MML's own hypotheses cannot be
  sourced, only argued, and the adverse and optimistic sets argue them.
- **Across sets the third-life fixed rate spans €372 to €558.** Optimistic
  (18-year life, 0.8 consumption, 4% capital, 2025 fuel) fits with €78 to
  spare; adverse (12-year life, 1.0 consumption, 7% capital, fuel at €2.30)
  needs €558 and no distance down to 10,000 km fits. That range, not the
  central point, is what a publication can honestly quote.
- The lifecycle standard holds: a sealed headlamp forces the assembly at
  €1,100; hail is cosmetic, repaired for €600 against €2,800 for the panel,
  and would cost an owner about €7,000 of resale value; at eight years and
  152,000 km, with a battery module due, the vehicle is worth €12,721
  repaired against €9,710 harvested and continues.

Every value's status is listed by `list_assumptions`, per set. The next
step for the model is the rest of M3, evidence for the other six vehicles
and for the fleet-side parameters; for the agent, the one the note
describes: put a real household in front of it.

## Boundaries

- Fixtures stand in for dealer inventory, finance, insurance and repair
  pricing. No external API is called. The adapters exist so that each source
  can be replaced independently.
- The hybrid residual curve is observed to year seven from asking prices, not
  transactions, and against today's list price rather than the original;
  years eight to fifteen are extrapolated. The petrol and BEV curves remain
  assumptions.
- Fleet stock is priced at the model's own mobility value, so ownership and
  rental of a later life are compared on the valuation MML itself uses.
- Prices carry a date. Fuel, tariffs and list prices move; the bundle records
  the fixture hashes it was computed from.
- Long-term rental of a later-life vehicle is rarely offered; it is shown on
  the same footing for comparability and says so. Its deductibles and
  return settlement are expected values from documented contract structure
  (franchigia bands, inspection thresholds), not from a published average,
  which does not exist.
- The Material Capital Credit accrues linearly to the material floor over the
  term. Chapter 2.5 leaves the method open; this is one method, labelled.
