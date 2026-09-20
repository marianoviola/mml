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

The `agency` prompt is the orchestrator's brief. It tells the hosting agent to
start from the requirement, to quote only what a tool returned, to name the
kind of every number that matters, to show what each mode charges for
rather than claim MML is cheaper, and to record every step.

## Running it

```bash
npx pnpm@10.15.0 install          # Node >= 24
npx pnpm@10.15.0 -r build
npx pnpm@10.15.0 -r test          # 22 tests: core, fixtures, scenario, MCP round-trip, CLI

node apps/cli/dist/index.js scenario four-fifty    # the journey without a language model
node apps/cli/dist/index.js assumptions finance    # provenance of every number
```

`.mcp.json` at the repository root registers the server for Claude Code.
Open the repository in Claude Code, run `/mcp` to confirm `mml` is
connected, then invoke the `agency` prompt with a customer id and ask the
€450 question. Customer records persist under `state/` as one JSON file
each, so a conversation can stop and resume in another session or runtime.

## What the first run says

The scenario runs Part 1's household, two adults, two children, regular long
journeys, 20,000 km a year, no home charging, €450 a month all-in, through
the whole graph. Its findings, under the fixture assumptions:

- No family-touring placement meets €450 at 20,000 km. The cheapest, a
  third-life Corolla Touring Sports, is €509 all-in; new, it is €672 under
  MML, €668 under long-term rental, €721 under ownership. The €450 question
  is not answered by a cheaper contract on a new car.
- The model finds what has to give: the same third-life vehicle at 12,500 km
  a year is €428. The scenario contracts on that basis and the trade-off is
  written into the context rather than hidden in a discount.
- A stone chip on the headlamp of a conventional model line forces the
  assembly, €1,100, because the lamp is sealed: chapter 3.6's point,
  reproduced on real design constraints rather than asserted.
- Hail is cosmetic, locally repaired for €600 against €2,800 for the panel;
  under ownership the same event would also cost about €7,000 of resale value.
- At eight years and 137,000 km, with a battery module due, the vehicle is
  worth €9,403 repaired against €9,247 as components and material. It
  continues, by a margin under 10%, and the model says the next significant
  repair reopens the question. That is chapter 3.10 operating as a rule
  rather than as a sentiment.

Every value is an assumption with a rationale, listed by
`list_assumptions`; none is evidence yet. The next step for the model is the
one M3 already describes: replace the scale references with quotations and
sources. The next step for the agent is the one the note describes: put a
real household in front of it.

## Boundaries

- Fixtures stand in for dealer inventory, finance, insurance and repair
  pricing. No external API is called. The adapters exist so that each source
  can be replaced independently.
- The residual curves are market-style and conservative; MML's fleet-internal
  value may sit higher because normal use is priced in.
- Long-term rental of a later-life vehicle is rarely offered; it is shown on
  the same footing for comparability and says so.
- The Material Capital Credit accrues linearly to the material floor over the
  term. Chapter 2.5 leaves the method open; this is one method, labelled.
