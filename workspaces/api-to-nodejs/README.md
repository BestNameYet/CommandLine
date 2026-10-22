# API-to-Node.js Execution Conversion

## Objective
Finish converting the GitHub API command surface into Node.js-executed operations, using the existing command parser, runner, and publisher architecture.

## Workspace scope
- Inventory the current GitHub API command catalog and its existing Node.js handlers.
- Map each supported operation to an explicit Node.js implementation and identify gaps.
- Implement and test remaining mappings inside this workspace before any authorized promotion to shared `src/` or workflow paths.
- Preserve FIFO-by-first-nonce ordering with optional `ordinal` overrides, one command per runner invocation, and publisher-owned result queue.
- Keep GitHub Issues operations as the command interface rather than bypassing it.

## Completion criteria
Each supported command has a verified Node.js execution path, argument validation, a structured result, and tests. Report unsupported commands explicitly. Changes outside this workspace require separate authorization.
