# Meta-instructor implementation plan

Goal: provide an interactive JSON protocol through the fixed Issue 6 prompt.
Approved specification: the current user request and subsequent Proceed instruction.
Location: workspaces/meta-instructor/.

1. Build pure controller and strict schemas: questions, answers, sufficiency assessment, five-or-more unique plan steps with explanations of at least 100 words, sequential completion reports, final report of at least 500 words.
2. Test invalid JSON shapes, boundaries, duplicate steps, stale responses, context follow-ups, blocked steps and full lifecycle. Validation failures preserve state.
3. Add GitHub comment adapter: owner-only fixed-input event, nonce/request ID, durable Issue 7 state, prompts and receipts. No external agent API is assumed; the responding agent executes requested work and submits JSON.
4. Register meta route using existing listener and a read-only-content/issues-write reusable workflow. Run focused and existing console tests before handling application commands.
5. Document commands, return schema extensions and evidence limitations; update repository metadata; verify commits and live start/status/invalid-response behavior.

Review focus: replayed replies; out-of-order step reports; hidden extra JSON fields; word-count boundaries; publication errors and duplicate sessions.
