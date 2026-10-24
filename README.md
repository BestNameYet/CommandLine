# CommandLine

## Five reserved input comments

The first five comments on Issue #6 are command inputs: `6358997143`, `6358997306`, `6359048816`, `6359050701`, and `6359050871`. Owner edits to any of these comments beginning with `gh>` plus arguments execute through the existing listener and route-specific workflow. Each workflow selects the originating ID only if it belongs to this fixed set; otherwise the original first ID remains selected for normalization. A bare `gh>` does not execute. Successful commands reset their own input to `gh>`. Full output remains in Issue #7, with originator and response IDs referenced in Issue #6. These five comments are reserved for input, not response-slot reuse. Statements below describing only one input refer to the earlier arrangement and are superseded by this section.


## Workflow changes: mandatory GitHub integration

**Required exception to the Issue #6 command-line rule:** For any creation, modification, replacement, or deletion of files under `.github/workflows/`, use the connected **GitHub integration** directly. **Do not use `gh>`, `gh> commit <commentID>`, or the Issue #6 commit workflow to change workflow files.** The Issue #6 runtime token is not a substitute for an integration credential authorized to update GitHub Actions workflows.

Read the current workflow and related repository instructions first; perform the file change through the GitHub integration, then fetch the resulting workflow from GitHub and verify its content and commit. If the integration denies workflow-file writes, report the limitation rather than bypassing the restriction through another command path. For non-workflow operations, continue to use the authorized Issue #6 command interface where applicable.

## Authorized GitHub command line

**[Issue #6 — GitHub CLI command console](https://github.com/BestNameYet/CommandLine/issues/6)** is the repository's authorized command-line interface for GitHub CLI operations. Use this console for requested `gh` commands rather than bypassing it with direct GitHub API calls.

Edit any of the first five input comments on Issue #6 containing the `gh>` prompt followed by GitHub CLI arguments (do **not** repeat `gh`):

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

The workflow executes `gh` on a GitHub Actions runner for owner edits to that input comment. It writes complete stdout/stderr and the exit code to a comment in [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). It then writes a separate **reference comment** in Issue #6 containing the submitted command and `responseCommentId`, which points to that Issue #7 output comment. Finally, it edits the submitted input comment back to `gh>`. Only owner edits to comment `6358997143` execute; the workflow explicitly checks this ID and the event sender. A standalone `gh>` does nothing. Human comments elsewhere are cleared to a hidden `<!-- issue6-response-slot:available -->` flag without executing. These render blank and are reused for later response references before new response comments are created. Invalid text in the input is also reset in place. Comment IDs and bot responses are preserved.

**Read the [Issue #6 README](docs/issue-6/README.md) for the exact protocol, permissions, and limitations.** This interface runs the GitHub CLI, not arbitrary shell commands. Authorization to use the console does not authorize unsolicited operations or the separately designed JavaScript functions.

## Agent guidance

Read [AGENTS.md](AGENTS.md) and applicable workspace instructions before repository work. For requested operations supported by this command line, use Issue #6 as the execution surface. Do not silently substitute direct APIs or other execution channels; if a command cannot run through Issue #6, report the limitation and obtain explicit authorization for any alternative.

## Reference documentation

- [Issue #6 GitHub CLI console](docs/issue-6/README.md) — command submission, response comments, and output storage.
- [GitHub Actions runtime and hosted-runner limits](docs/GITHUB_ACTIONS_RUNTIME_LIMITS.md) — exact documented ceilings, runner hardware, and configuration distinctions for the JavaScript container.

## Commit adapter

The Issue #6 listener uses `runtime/issue6-route.cjs` to select one reusable workflow. Ordinary `gh>` commands use `.github/workflows/issue-6-standard.yml` (`contents: read`, `issues: write`). The explicit `gh> commit <commentID>` command uses `.github/workflows/issue-6-commit.yml` (`contents: write`, `issues: write`).

The commit command reads an Issue #7 comment containing a JSON object with `filename` (repository-relative path) and `body` (string file contents), validates it, and creates or updates that file in `CommandLine`. Successful and failed results are published to Issue #7; the reference is placed in Issue #6 and the fixed prompt is reset. See [the commit protocol](docs/issue-6/COMMIT_ADAPTER.md).


## Meta-instructor output IDs

The meta-instructor in [workspaces/meta-instructor/](workspaces/meta-instructor/README.md)
uses the fixed Issue #6 prompt for commands, but **selects a separate Issue #7
output comment per session nonce**. The ID created at `meta start` is reused
for subsequent `meta respond` and `meta status` calls: results are appended
to that session comment's `outputs` array by editing the same comment ID.
No global meta output comment ID is canonical. The session's `state` is
stored once; appended outputs omit duplicated context.
