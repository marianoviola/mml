# Agentic MML: an orchestration-layer experiment

Working note. Not part of the canonical MML model — a parallel line of inquiry.

## The question

MML (`packages/core`, `apps/cli`, `apps/mcp`) models what a lifecycle-native
approach to mobility would look like if the underlying industry — OEM,
dealer, finance, insurance, commerce, maintenance, resale — actually
restructured around the vehicle's productive lifecycle instead of around
discrete sale transactions. That restructuring is slow and may never
fully happen.

Agentic MML asks a narrower, more immediate question: can a software layer
deliver the *experience* of a lifecycle-native model today, on top of the
fragmented systems that already exist, without waiting for the industry
underneath to change? If a persistent orchestrator can coordinate
specialised tools across OEM, dealer, finance, insurance, commerce,
maintenance and resale systems, the customer-facing result may look and
feel lifecycle-native even while the back-end stays fragmented.

## Framing: graph, not funnel

The conventional automotive funnel is linear — awareness, consideration,
purchase, ownership, disposal — because the systems behind it are linear
handoffs between separate parties. A lifecycle-native experience requires
treating those stages as a graph instead: a customer can move between
financing, maintenance, resale and re-financing in any order, and the
orchestration layer's job is to keep a consistent, coherent state across
whichever domain tool is invoked next.

## Shape of the experiment

- A persistent orchestrator holds customer/vehicle state across the
  lifecycle and decides which domain tool to invoke.
- One specialised tool/agent per domain: OEM, dealer, finance, insurance,
  commerce, maintenance, resale. Each tool encapsulates the logic and
  integration surface for its domain; the orchestrator does not.
- The orchestrator composes tool outputs into a single coherent
  experience — it does not contain domain logic itself, mirroring the
  MCP layer's own rule in MML proper: the adapter exposes, it does not
  compute.

## Relationship to MML

Agentic MML is additive and experiential, not a replacement for the core
model. MML's DCF, Monte Carlo and Agency-economics work continues on its
own track in `packages/core` / `apps/cli` / `apps/mcp`. Agentic MML lives
in `agentic-mml/` and does not restructure or depend on the core model's
code. If the orchestration experiment produces evidence worth folding
back into MML's economics (e.g. what an orchestration layer costs to run,
or what it implies for Agency composition), that's a deliberate future
integration point — not an assumption made now.

## Non-goals (for now)

- No implementation logic in the domain tools yet — interfaces/stubs only.
- No dependency on the editorial track ("The Lifecycle of Transition"),
  which lives outside this repository.
- No claim that orchestration alone solves what industry restructuring
  would otherwise require — this tests experience, not economics.

## Open questions

- What is the minimum state the orchestrator must hold to make the graph
  (rather than funnel) framing hold up across domain tools?
- Where does an orchestration layer's own cost belong in MML's Agency
  economics, if the experiment is judged worth folding back?
- Which domain tool is worth prototyping first to falsify the hypothesis
  fastest — likely the two domains with the most fragmented real-world
  handoff today?
