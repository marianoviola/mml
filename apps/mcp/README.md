# MML MCP

This application will expose the MML computational model through Model Context Protocol tools.

Initial tool surface:

- `simulate_scenario`
- `compare_scenarios`
- `find_break_even`
- `get_assumptions`

The MCP layer must remain an adapter. Economic logic belongs in `@mml/core`.

No server dependency is installed during bootstrap. The protocol implementation starts only after the deterministic core and scenario schema are stable.
