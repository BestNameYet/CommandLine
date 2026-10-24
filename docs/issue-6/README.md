# Issue #6 — GitHub CLI command console

## Five reserved input comments

The first five comments on Issue #6 are command inputs: `6358997143`, `6358997306`, `6359048816`, `6359050701`, and `6359050871`. Owner edits to any of these comments beginning with `gh>` plus arguments execute through the existing listener and route-specific workflow. Each workflow selects the originating ID only if it belongs to this fixed set; otherwise the original first ID remains selected for normalization. A bare `gh>` does not execute. Successful commands reset their own input to `gh>`. Full output remains in Issue #7, with originator and response IDs referenced in Issue #6. These five comments are reserved for input, not response-slot reuse. Statements below describing only one input refer to the earlier arrangement and are superseded by this section.


**Issue:** https://github.com/BestNameYet/CommandLine/issues/6  
**Execution workflow:** [`.github/workflows/issue-6-gh.yml`](../../.github/workflows/issue-6-gh.yml)  
**Executor:** [`runtime/issue6-gh-command.cjs`](../../runtime/issue6-gh-command.cjs)

## Workflow changes: mandatory GitHub integration

**Required exception to the Issue #6 command-line rule:** For any creation, modification, replacement, or deletion of files under `.github/workflows/`, use the connected **GitHub integration** directly. **Do not use `gh>`, `gh> commit <commentID>`, or the Issue #6 commit workflow to change workflow files.** The Issue #6 runtime token is not a substitute for an integration credential authorized to update GitHub Actions workflows.

Read the current workflow and related repository instructions first; perform the file change through the GitHub integration, then fetch the resulting workflow from GitHub and verify its content and commit. If the integration denies workflow-file writes, report the limitation rather than bypassing the restriction through another command path. For non-workflow operations, continue to use the authorized Issue #6 command interface where applicable.

## Purpose

Issue #6 is a GitHub CLI command surface. It is **not** the destination for full command stdout/stderr, and it does not run the separate `render.cjs` program.

The first comment is the visible `gh>` prompt (currently comment ID `6358997143`). The only command input is this first comment. Submit each command by editing it, prefixed with `gh>`, for example:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Do not repeat `gh` after the prompt: the workflow invokes the `gh` executable itself. A standalone `gh>` is not executable.

## Implemented command lifecycle

1. **Trigger.** Owner edits to the first input comment (ID `6358997143`) execute commands. The workflow checks this exact ID and event sender. Other human comments are cleared and flagged as available response slots without executing. A standalone `gh>` never executes.
2. **Parse.** The executor checks for the `gh>` prefix, removes it, and parses the remaining arguments.
3. **Execute.** Node.js `spawnSync('gh', args)` invokes the GitHub CLI on an `ubuntu-latest` GitHub Actions runner without a shell. The workflow passes `GH_TOKEN` with `contents: read` and `issues: write` permissions.
4. **Store full output.** The runner publishes a new comment in **[Issue #7 — Command Output Storage](https://github.com/BestNameYet/CommandLine/issues/7)**. This comment holds the command's exit code, stdout, stderr, and source comment ID. Its new GitHub comment ID is `responseCommentId`.
5. **Publish command reference.** The runner overwrites an available flagged comment in **Issue #6**, or creates a response comment if no flagged slot is available. The response contains `originatorCommentId` (the submitted command comment ID), a copy of the command, and `responseCommentId`.
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

The only input is first comment `6358997143`. Owner edits containing `gh>` plus arguments execute; a bare `gh>` does nothing. Invalid text in that input is reset to `gh>`. The workflow authorizes edits by event sender because the input comment is bot-authored.

Other human comments are cleared to exactly `<!-- issue6-response-slot:available -->`. This hidden HTML flag renders blank and marks the comment for later overwrite. GitHub rejects a literally empty body. Bot responses are preserved. Comments and IDs are never deleted.

When publishing an Issue #6 reference, the runner looks through all comment pages for the first available flagged slot, excluding the input ID. It overwrites that slot with the response and keeps the slot's comment ID. If no slot exists, it creates a new response comment. Full output remains in Issue #7.

Run the focused regression checks with `node --test tests/issue6-gh-command.test.cjs`.

## Commit adapter (additional command route)

The workflow `.github/workflows/issue-6-gh.yml` now preprocesses Issue #6 events with `runtime/issue6-route.cjs` and calls one reusable workflow. `.github/workflows/issue-6-standard.yml` retains the existing read-only `gh` executor and comment normalization. `.github/workflows/issue-6-commit.yml` is a separate write-enabled workflow supporting `gh> commit <commentID>`. It validates a JSON file object in Issue #7 and commits its `filename` and `body` to this repository. See [COMMIT_ADAPTER.md](COMMIT_ADAPTER.md) for the exact accepted format and safeguards.


## Meta-instructor session output

Meta-instructor commands use the same fixed Issue #6 input comment, but the
meta-instructor chooses one distinct Issue #7 output comment ID per nonce.
All later responses and status outputs for that session append to its
`outputs` array by updating that ID in place; `responseCommentId` in Issue #6
refers to the same output for the lifetime of the session. Independent meta
instances must not share one canonical output ID. See
[meta-instructor README](../../workspaces/meta-instructor/README.md).
