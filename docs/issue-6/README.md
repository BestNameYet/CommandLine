# Issue #6 — GitHub CLI command console

**Issue:** https://github.com/BestNameYet/CommandLine/issues/6  
**Execution workflow:** [`.github/workflows/issue-6-gh.yml`](../../.github/workflows/issue-6-gh.yml)  
**Executor:** [`runtime/issue6-gh-command.cjs`](../../runtime/issue6-gh-command.cjs)

## Purpose

Issue #6 is a GitHub CLI command surface. It is **not** the destination for full command stdout/stderr, and it does not run the separate `render.cjs` program.

The first comment is the visible `gh>` prompt (currently comment ID `6358997143`). A submitted command is a **new comment**, prefixed with `gh>`, for example:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Do not repeat `gh` after the prompt: the workflow invokes the `gh` executable itself. A standalone `gh>` is not executable.

## Implemented command lifecycle

1. **Trigger.** A newly **created** Issue #6 comment triggers `issue-6-gh.yml`. Only comments authored by the repository owner are eligible. Edited comments are not triggers.
2. **Parse.** The executor checks for the `gh>` prefix, removes it, and parses the remaining arguments.
3. **Execute.** Node.js `spawnSync('gh', args)` invokes the GitHub CLI on an `ubuntu-latest` GitHub Actions runner without a shell. The workflow passes `GH_TOKEN` with `contents: read` and `issues: write` permissions.
4. **Store full output.** The runner publishes a new comment in **[Issue #7 — Command Output Storage](https://github.com/BestNameYet/CommandLine/issues/7)**. This comment holds the command's exit code, stdout, stderr, and source comment ID. Its new GitHub comment ID is `responseCommentId`.
5. **Publish command reference.** The runner posts a separate comment in **Issue #6** containing only a copy of the command and `responseCommentId`.
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
  "command": "gh> issue view 6 --repo BestNameYet/CommandLine",
  "responseCommentId": 67890
}
```

IDs in the examples are illustrative. Follow the `responseCommentId` to retrieve the output comment; the full output is **not** embedded in the Issue #6 reference.

## Important operational distinctions

- The first prompt comment remains the earliest comment in Issue #6. The current workflow resets **each newly submitted command comment** to `gh>`; it does not move the original first comment.
- GitHub comment IDs are stable when bodies are edited. Editing a prompt comment does **not** invoke this workflow because it listens only for `created` events.
- If output or reference publication fails, the submitted command comment is not reset. If reference publication fails after output publication, an output comment may exist without a reference.
- Execution failures are captured with a nonzero exit code and stderr when possible; they do not necessarily prevent the response from being published.
- Older Issue #6 comments predate this arrangement. In particular, reference comment `6358997306` points to `6358997143`, which was later repurposed as the first `gh>` prompt. This is a **historical stale reference**.

## Verified execution

A live command submitted to Issue #6 (`6359258024`) was executed successfully. Output comment `6359260565` was created in Issue #7, reference comment `6359260753` was created in Issue #6, and input comment `6359258024` was edited to `gh>`.

This README records the **existing implementation**; it does not prescribe additional command processing or invoke any of the separately designed `create`, `read`, `commit`, or `render` scripts.
