# Issue #6 — GitHub CLI command console

**Issue:** https://github.com/BestNameYet/CommandLine/issues/6  
**Execution workflow:** [`.github/workflows/issue-6-gh.yml`](../../.github/workflows/issue-6-gh.yml)  
**Executor:** [`runtime/issue6-gh-command.cjs`](../../runtime/issue6-gh-command.cjs)

## Purpose

Issue #6 is a GitHub CLI command surface. It is **not** the destination for full command stdout/stderr, and it does not run the separate `render.cjs` program.

The first comment is the visible `gh>` prompt (currently comment ID `6358997143`). The only command input is this first comment. Submit each command by editing it, prefixed with `gh>`, for example:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Do not repeat `gh` after the prompt: the workflow invokes the `gh` executable itself. A standalone `gh>` is not executable.

## Implemented command lifecycle

1. **Trigger.** Owner edits to the first input comment (ID `6358997143`) execute commands. The workflow checks this exact ID and event sender. Other human comments are normalized only. A standalone `gh>` never executes.
2. **Parse.** The executor checks for the `gh>` prefix, removes it, and parses the remaining arguments.
3. **Execute.** Node.js `spawnSync('gh', args)` invokes the GitHub CLI on an `ubuntu-latest` GitHub Actions runner without a shell. The workflow passes `GH_TOKEN` with `contents: read` and `issues: write` permissions.
4. **Store full output.** The runner publishes a new comment in **[Issue #7 — Command Output Storage](https://github.com/BestNameYet/CommandLine/issues/7)**. This comment holds the command's exit code, stdout, stderr, and source comment ID. Its new GitHub comment ID is `responseCommentId`.
5. **Publish command reference.** The runner posts a separate comment in **Issue #6** containing `originatorCommentId` (the submitted command comment ID), a copy of the command, and `responseCommentId`.
6. **Reset input.** After the two publications succeed, the runner edits the originally submitted command comment so its entire body is `gh>`. The comment ID is preserved; the command is **not** deleted.

### Output comment in Issue #7

```json
{
  "type": "gh-command-result",
  "sourceCommentId": 12345,
  "exitCode": 0,
  "stdout": "Complete CLI stdout",
  "stderr": ""
}
```

### Reference comment in Issue #6

```json
{
  "originatorCommentId": 12345,
  "command": "gh> issue view 6 --repo BestNameYet/CommandLine",
  "responseCommentId": 67890
}
```

IDs in the examples are illustrative. Use `originatorCommentId` to identify the input comment and follow `responseCommentId` to retrieve the output comment; the full output is **not** embedded in the Issue #6 reference.

## Important operational distinctions

- The first prompt comment remains the earliest comment in Issue #6. The current workflow resets **each newly submitted command comment** to `gh>`; it does not move the original first comment.
- GitHub comment IDs are stable when bodies are edited. Editing the fixed first input comment as the owner with `gh>` plus arguments executes that command. A standalone `gh>` does nothing.
- If output or reference publication fails, the submitted command comment is not reset. If reference publication fails after output publication, an output comment may exist without a reference.
- Execution failures are captured with a nonzero exit code and stderr when possible; they do not necessarily prevent the response from being published.
- Older Issue #6 comments predate this arrangement. In particular, reference comment `6358997306` points to `6358997143`, which was later repurposed as the first `gh>` prompt. This is a **historical stale reference**.

## Verified execution

A live command submitted to Issue #6 (`6359258024`) was executed successfully. Output comment `6359260565` was created in Issue #7, reference comment `6359260753` was created in Issue #6, and input comment `6359258024` was edited to `gh>`.

This README records the **existing implementation**; it does not prescribe additional command processing or invoke any of the separately designed `create`, `read`, `commit`, or `render` scripts.

## Comment format enforcement

The fixed first comment accepts `gh>` plus command arguments; a bare `gh>` is an idle prompt. Bot responses elsewhere are retained as written. On `created` and `edited` events in Issue #6, invalid input text and other human comment bodies are replaced with exactly `gh>` using PATCH. The comment and its ID are preserved; no comment is deleted. Bot responses are unchanged. Only owner edits to comment `6358997143` execute; a standalone `gh>` never executes. The bot-authored first prompt is authorized by the event sender. Other human comments are reset to `gh>` without executing, even if they contain command syntax. Reuse the fixed input comment for every command. The runner re-reads invalid comments before resetting them to avoid overwriting an input that has since become valid.

Run the focused regression checks with `node --test tests/issue6-gh-command.test.cjs`.
