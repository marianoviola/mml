# Agentic MML

An experiment in delivering a lifecycle-native mobility *experience* through
agentic orchestration over today's fragmented systems, rather than waiting
for the industry underneath to restructure. See
[`../notes/mml-agentic-lifecycle.md`](../notes/mml-agentic-lifecycle.md) for
the full working note — hypothesis, scope, non-goals, open questions.

This directory is separate from and does not depend on `packages/core`,
`apps/cli` or `apps/mcp`. It is additive to the MML model, not a
replacement or a refactor of it.

## Pattern

- **Orchestrator** (`orchestrator/`): a persistent coordinator that holds
  customer/vehicle state across the lifecycle and decides which domain
  tool to invoke next. It composes tool outputs into a coherent
  experience; it does not contain domain logic itself.
- **Domain tools** (`tools/`): one specialised tool per domain —
  OEM, dealer, finance, insurance, commerce, maintenance, resale. Each
  tool encapsulates the logic and integration surface for its own domain.

## Status

Scaffold only. Interfaces are placeholders with no implementation logic.
