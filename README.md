# CommandLine

## Authorized GitHub command line

**[Issue #6 — GitHub CLI command console](https://github.com/BestNameYet/CommandLine/issues/6)** is the repository's authorized command-line interface for GitHub CLI operations. Use this console for requested `gh` commands rather than bypassing it with direct GitHub API calls.

Submit a **new comment** to Issue #6 containing the `gh>` prompt followed by GitHub CLI arguments (do **not** repeat `gh`):

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

The workflow executes `gh` on a GitHub Actions runner for owner-authored comments. It writes complete stdout/stderr and the exit code to a comment in [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). It then writes a separate **reference comment** in Issue #6 containing the submitted command and `responseCommentId`, which points to that Issue #7 output comment. Finally, it edits the submitted input comment back to `gh>`. Editing an existing comment does not trigger command execution; a command must be a new comment. New and edited human comments outside the `gh>` input format are edited to exactly `gh>` with their IDs preserved. Bot responses remain unchanged; enforcement never deletes comments.

**Read the [Issue #6 README](docs/issue-6/README.md) for the exact protocol, permissions, and limitations.** This interface runs the GitHub CLI, not arbitrary shell commands. Authorization to use the console does not authorize unsolicited operations or the separately designed JavaScript functions.

## Agent guidance

Read [AGENTS.md](AGENTS.md) and applicable workspace instructions before repository work. For requested operations supported by this command line, use Issue #6 as the execution surface. Do not silently substitute direct APIs or other execution channels; if a command cannot run through Issue #6, report the limitation and obtain explicit authorization for any alternative.

## Reference documentation

- [Issue #6 GitHub CLI console](docs/issue-6/README.md) — command submission, response comments, and output storage.
- [GitHub Actions runtime and hosted-runner limits](docs/GITHUB_ACTIONS_RUNTIME_LIMITS.md) — exact documented ceilings, runner hardware, and configuration distinctions for the JavaScript container.
