# Agent instructions — CommandLine

## Required documentation

Read this `AGENTS.md`, the repository's current [README.md](README.md), and any applicable workspace instructions before repository work. Treat these documents as governing instructions for the current repository. Do not assume deleted services or undocumented runners remain available.

## Authorized GitHub command line

**[Issue #6 — GitHub CLI command console](https://github.com/BestNameYet/CommandLine/issues/6) is the authorized repository command line for GitHub CLI operations.**

To execute a requested `gh` command, create a **new comment** on Issue #6 beginning with `gh>`, followed by CLI arguments. Do not repeat `gh` after the prompt:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Do not edit an existing comment to submit a command: the workflow responds to newly created comments only. It executes owner-authored commands through GitHub Actions.

The runner publishes complete stdout, stderr, and exit status to a comment in [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). In Issue #6 it publishes a separate comment containing the original command and `responseCommentId`, which identifies the output comment. The submitted command comment is edited back to `gh>` after both publications succeed.

Read [docs/issue-6/README.md](docs/issue-6/README.md) for precise behavior and limitations. A standalone `gh>` is a prompt, not a command. Issue #6 executes GitHub CLI commands, not general shell commands.

Use this documented command interface for applicable, explicitly authorized GitHub CLI operations. Do not silently bypass it with direct APIs or alternative execution mechanisms. If the requested operation cannot be performed through the command interface, disclose the limitation instead of claiming it executed. Do not invoke separately designed `create`, `read`, `commit`, or `render` functions without explicit authorization.

## Repository structure

Preserve the existing `workspaces/`, `src/`, `config/`, `tests/`, `runtime/`, `docs/`, and `.github/workflows/` directories unless an approved task requires changes.
