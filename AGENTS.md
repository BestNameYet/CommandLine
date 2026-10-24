# Agent instructions — CommandLine

## Required documentation

Read this `AGENTS.md`, the repository's current [README.md](README.md), and any applicable workspace instructions before repository work. Treat these documents as governing instructions for the current repository. Do not assume deleted services or undocumented runners remain available.

## Workflow changes: mandatory GitHub integration

**Required exception to the Issue #6 command-line rule:** For any creation, modification, replacement, or deletion of files under `.github/workflows/`, use the connected **GitHub integration** directly. **Do not use `gh>`, `gh> commit <commentID>`, or the Issue #6 commit workflow to change workflow files.** The Issue #6 runtime token is not a substitute for an integration credential authorized to update GitHub Actions workflows.

Read the current workflow and related repository instructions first; perform the file change through the GitHub integration, then fetch the resulting workflow from GitHub and verify its content and commit. If the integration denies workflow-file writes, report the limitation rather than bypassing the restriction through another command path. For non-workflow operations, continue to use the authorized Issue #6 command interface where applicable.

## Authorized GitHub command line

**[Issue #6 — GitHub CLI command console](https://github.com/BestNameYet/CommandLine/issues/6) is the authorized repository command line for GitHub CLI operations.**

To execute a requested `gh` command, edit only the first input comment on Issue #6 (ID `6358997143`) beginning with `gh>`, followed by CLI arguments. Do not repeat `gh` after the prompt:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Only owner edits to that fixed input comment can execute commands. The workflow gates execution on its ID and the event sender, because the first prompt is bot-authored. A standalone `gh>` never executes. Other human comments are cleared to a hidden `<!-- issue6-response-slot:available -->` flag without executing; they render blank and are reused for later response references. Bot responses remain unchanged. Reuse the same input comment for every command.

The runner publishes complete stdout, stderr, and exit status to a comment in [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). In Issue #6 it publishes a separate comment containing the original command and `responseCommentId`, which identifies the output comment. The submitted command comment is edited back to `gh>` after both publications succeed.

Read [docs/issue-6/README.md](docs/issue-6/README.md) for precise behavior and limitations. A standalone `gh>` is a prompt, not a command. Issue #6 executes GitHub CLI commands, not general shell commands.

Use this documented command interface for applicable, explicitly authorized GitHub CLI operations. Do not silently bypass it with direct APIs or alternative execution mechanisms. If the requested operation cannot be performed through the command interface, disclose the limitation instead of claiming it executed. Do not invoke separately designed `create`, `read`, `commit`, or `render` functions without explicit authorization.

## Repository structure

Preserve the existing `workspaces/`, `src/`, `config/`, `tests/`, `runtime/`, `docs/`, and `.github/workflows/` directories unless an approved task requires changes.

## Issue #6 routing and authorized commit adapter

The GitHub command listener `.github/workflows/issue-6-gh.yml` invokes `runtime/issue6-route.cjs` before execution. Ordinary CLI commands and comment normalization use `.github/workflows/issue-6-standard.yml` with `contents: read` and `issues: write`. The explicitly requested `gh> commit <commentID>` command uses `.github/workflows/issue-6-commit.yml` with `contents: write` and `issues: write`.

For `gh> commit <commentID>`, the referenced comment must be on Issue #7 and contain a valid JSON file object (`filename` as a safe repository-relative path, `body` as a string). The adapter checks the source, path, size, target, and commit receipt. Results are written to Issue #7 and referenced on Issue #6; do not claim a commit occurred without a successful commit SHA or verified unchanged result. This routing does not authorize other unrequested mutations. See [commit adapter protocol](docs/issue-6/COMMIT_ADAPTER.md).


## Meta-instructor output ownership

For the interactive meta-instructor, the fixed Issue #6 command-input comment
is not an output location. Each session nonce chooses its own Issue #7 output
comment at `gh> meta start`; preserve that comment ID and append later
results to its `outputs` by editing the **same** Issue #7 comment. Never
share a canonical output comment across concurrent or interleaved sessions.
The persisted session `state` is authoritative; the agent reads compact
output requests and return schemas from its own comment's `outputs` array.
See [meta-instructor README](workspaces/meta-instructor/README.md).
