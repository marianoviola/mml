# @mml/mcp

The MML lifecycle exposed over the Model Context Protocol. Any orchestrating
agent that speaks MCP (Claude Code, Claude Desktop, another runtime) can act as
the Agency: one continuous relationship with a household across requirement,
shortlist, quote, contract, ownership, repair and continuation, with every
number coming from the model.

This layer is an adapter. It contains no economic logic: every tool is a thin
call into `@mml/lifecycle`, which composes `@mml/core` over `@mml/data` and
writes the result to a persistent customer context. See `docs/AGENTIC.md` for
the design and `docs/METHODOLOGY.md` for the evidence / assumption / derived
distinction the tools preserve.

## Tools

| Tool | Node | What it does |
| --- | --- | --- |
| `get_context` | context | The persistent record of one customer. Read it first. |
| `list_catalogue` | — | Vehicles, placements (new dealer offers and later-life fleet stock) and repair event types the model knows. |
| `capture_household` | requirement | Record needs and budget; derive mobility class, term and constraints. Required before shortlist or quote. |
| `shortlist_placements` | shortlist | Every eligible vehicle in every life the fleet can place it in, priced as a Mobility Rate, cheapest first; plus exclusions and why. |
| `quote_placement` | comparison | Full Mobility Rate composition for one offer; ownership, long-term rental and MML on one footing; what would have to give if the budget is not met. |
| `sign_contract` | contract | Place the customer: fixed rate, variable-use estimate, term, distance allowance, Material Capital Credit floor. |
| `advance_time` | ownership | Age the vehicle, accrue distance, build the credit, flag scheduled refurbishments. |
| `report_event` | repair | Assess an event against the lifecycle standard: state, response, repair before replacement, downtime, continuity, and the same event under ownership. |
| `resolve_event` | repair | Mark an open event repaired and recorded in the asset ledger. |
| `review_continuation` | continuation | Decide on the fleet's money: repaired value against component and material value; keep, refurbish, reassign or retire. |
| `list_assumptions` | provenance | Every provenanced fixture value with its kind and rationale. Filter by path prefix, e.g. `finance`. |
| `sensitivity_placement` | — | Shock every provenanced input one at a time and rank what moves one placement's monthly cost under each mode. Reads the context, writes nothing. |
| `break_even_placement` | — | The distance at which MML meets the budget, and the structural life, cost of capital and consumption factor at which it costs what rental costs; "none" when nothing in range does. Reads the context, writes nothing. |

## Resources and prompt

- `mml://customers/{id}` — the customer context as JSON, one per customer.
- `mml://assumptions` — provenance of every fixture value.
- Prompt `agency` (`customer_id`) — the orchestrator brief: start from the
  requirement, quote only what a tool returned, name the kind of every number
  that matters, show what each mode charges for rather than claim MML is
  cheaper, record every step.

## Running

```bash
pnpm install && pnpm -r build
pnpm --filter @mml/mcp start        # stdio transport
```

`.mcp.json` at the repository root registers the server for Claude Code with
`MML_STATE_DIR=state`. Customer contexts are written there as one JSON file
each (gitignored), so a conversation can stop and resume in another session.

Tool errors are returned as tool results, not protocol failures, and
operations refuse to run out of order (no quote before a requirement, no
continuation review before a contract).

## Boundaries

Fixtures stand in for dealer inventory, finance, insurance and repair pricing;
no external API is called. The server runs on the central assumption set;
the adverse and optimistic sets are available through the CLI and the
canonical bundles. `simulate_scenario` follows Monte Carlo (roadmap M5).
