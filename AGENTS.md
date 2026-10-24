# Agent instructions — CommandLine

## Central job queue — required

**All agents receive their jobs from the single [Issue #7 job-queue comment](https://github.com/BestNameYet/CommandLine/issues/7#issuecomment-6389130786) (comment ID `6389130786`).** Read that exact comment before selecting or resuming work. Keep all jobs and their completion statuses in its JSON `jobs` array; update the same comment throughout each job.

**Issue #6 is only for updates to this central Issue #7 queue.** Add or revise jobs and update their progress there; do not submit the actual work itself to Issue #6. Agents read their assignments from Issue #7 and perform the assigned work using the appropriate authorized integration or runtime. This rule supersedes older direct-work submission instructions and examples below, including direct `gh> commit` and `gh> meta` submissions. Those sections describe existing runner capabilities, not permission to bypass the queue.

The queue uses this JSON shape:

```json
{
  "type": "job-queue",
  "jobs": [
    {
      "id": "job-001",
      "description": "The work to perform",
      "status": "pending",
      "progress": 0
    }
  ]
}
```

Use `pending`, `in_progress`, `blocked`, or `completed` for `status`; `progress` is a completion percentage from 0 to 100. As work advances, update its existing job entry. Mark a job completed only after verifying its result. Retain completed jobs so the same comment shows the work and its final status.

Before writing, reread the queue and preserve other jobs and their latest updates. Do not create a separate queue per agent. The central comment is the authoritative assignment and progress record; other Issue #7 comments may still hold source files, outputs, and execution receipts.

To update the queue through an idle reserved Issue #6 input, use the existing GitHub CLI transport:

```text
gh> api repos/BestNameYet/CommandLine/issues/comments/6389130786 --method PATCH -f 'body=<complete updated queue JSON>'
```

Replace the placeholder with the complete JSON record using the CLI's supported quoting. Inspect the execution receipt, then read comment `6389130786` back to verify the saved queue. A submitted update alone is not a completed update.

The queue is an agent procedure backed by a persistent comment. The current listener has not yet been changed to enforce queue-only submissions or automatically assign jobs. Workflow integration requirements and matching workflow SHAs still apply to jobs that modify workflows.


## Five reserved input comments

Edit any of the following five comments on [Issue #6](https://github.com/BestNameYet/CommandLine/issues/6) to submit a command:

| Input | Comment ID |
| --- | --- |
| 1 | [6358997143](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6358997143) |
| 2 | [6358997306](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6358997306) |
| 3 | [6359048816](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6359048816) |
| 4 | [6359050701](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6359050701) |
| 5 | [6359050871](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6359050871) |

Only owner edits to these five IDs can execute commands. Use `gh>` followed by CLI arguments; a bare `gh>` does nothing. Choose an idle input displaying `gh>` and wait for its result before reusing that input. After output and reference publication succeed, that same input resets to `gh>`. Full output is stored in Issue #7; Issue #6 references include `originatorCommentId` and `responseCommentId`. The five input comments retain their IDs and are reserved for command entry.

## Required documentation

Read this `AGENTS.md`, the repository's current [README.md](README.md), and any applicable workspace instructions before repository work. Treat these documents as governing instructions for the current repository. Do not assume deleted services or undocumented runners remain available.

## Workflow changes: mandatory GitHub integration

**Required exception to the Issue #6 command-line rule:** For any creation, modification, replacement, or deletion of files under `.github/workflows/`, use the connected **GitHub integration** directly. **Do not use `gh>`, `gh> commit <commentID>`, or the Issue #6 commit workflow to write the live files under `.github/workflows/`.** The Issue #6 runtime token is not a substitute for an integration credential authorized to update GitHub Actions workflows.

For each new or updated workflow, use this required candidate-first sequence:

1. Read the current workflow, its local copy, and applicable repository instructions. Prepare the candidate YAML while preserving its spacing and line breaks.
2. Submit the candidate through the Issue #6 command interface and commit it first to `workspaces/api-to-nodejs/workflows/<filename>`. Use the documented file object on Issue #7 (`filename` is that local repository path; `body` is the candidate YAML), then edit an idle reserved Issue #6 input to `gh> commit <commentID>`. Inspect the successful commit receipt and verify the saved candidate. Raw candidate YAML is not an executable Issue #6 command.
3. Use the connected GitHub integration to create or update `.github/workflows/<filename>` with exactly the saved candidate's bytes. This is a SHA-identical content copy: preserve the YAML filename, spacing, encoding, and line endings. Do not replace it with a link or wrapper.
4. Fetch the resulting live workflow and local candidate, verify their content and commits, and require their Git blob SHAs to be equal before reporting completion or resuming ordinary Issue #6 commands.

Committing the local candidate first temporarily makes the workflow SHA comparison false. The listener must stop and print the mismatch while that is true; use the required GitHub integration to complete the live copy, rather than bypassing or disabling the gate. The listener continues only when the overall workflow SHA AND comparison is true.

If the integration denies workflow-file writes, report the incomplete promotion and the SHA mismatch rather than bypassing the restriction through another command path. For non-workflow operations, continue to use the authorized Issue #6 command interface where applicable.

## Authorized GitHub command line

**[Issue #6 — GitHub CLI command console](https://github.com/BestNameYet/CommandLine/issues/6) is the authorized repository command line for GitHub CLI operations.**

To execute a requested `gh` command, edit any of the first five input comments on Issue #6 beginning with `gh>`, followed by CLI arguments. Do not repeat `gh` after the prompt:

```text
gh> issue view 6 --repo BestNameYet/CommandLine --json number,title
```

Only owner edits to the five reserved input comments can execute commands. The workflow checks membership in the five-ID set and authorizes the event sender, including when an input is bot-authored. A standalone `gh>` never executes. Other human comments are cleared to a hidden `<!-- issue6-response-slot:available -->` flag without executing; they render blank and are reused for later response references. Bot responses remain unchanged. Reuse any of the five idle input comments.

The runner publishes complete stdout, stderr, and exit status to a comment in [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). In Issue #6 it publishes a separate comment containing the original command and `responseCommentId`, which identifies the output comment. The submitted command comment is edited back to `gh>` after both publications succeed.

Read [docs/issue-6/README.md](docs/issue-6/README.md) for precise behavior and limitations. A standalone `gh>` is a prompt, not a command. Issue #6 executes GitHub CLI commands, not general shell commands.

Use this documented command interface for applicable, explicitly authorized GitHub CLI operations. Do not silently bypass it with direct APIs or alternative execution mechanisms. If the requested operation cannot be performed through the command interface, disclose the limitation instead of claiming it executed. Do not invoke separately designed `create`, `read`, `commit`, or `render` functions without explicit authorization.

## Repository structure

Preserve the existing `workspaces/`, `src/`, `config/`, `tests/`, `runtime/`, `docs/`, and `.github/workflows/` directories unless an approved task requires changes.

## Issue #6 routing and authorized commit adapter

The GitHub command listener `.github/workflows/issue-6-gh.yml` invokes `runtime/issue6-route.cjs` before execution. Ordinary CLI commands and comment normalization use `.github/workflows/issue-6-standard.yml` with `contents: read` and `issues: write`. The explicitly requested `gh> commit <commentID>` command uses `.github/workflows/issue-6-commit.yml` with `contents: write` and `issues: write`.

For `gh> commit <commentID>`, the referenced comment must be on Issue #7 and contain a valid JSON file object (`filename` as a safe repository-relative path, `body` as a string). The adapter checks the source, path, size, target, and commit receipt. Results are written to Issue #7 and referenced on Issue #6; do not claim a commit occurred without a successful commit SHA or verified unchanged result. This routing does not authorize other unrequested mutations. See [commit adapter protocol](docs/issue-6/COMMIT_ADAPTER.md).


## Meta-instructor output ownership

For the interactive meta-instructor, the five reserved Issue #6 command-input comments
are not output locations. Each session nonce chooses its own Issue #7 output
comment at `gh> meta start`; preserve that comment ID and append later
results to its `outputs` by editing the **same** Issue #7 comment. Never
share a canonical output comment across concurrent or interleaved sessions.
The persisted session `state` is authoritative; the agent reads compact
output requests and return schemas from its own comment's `outputs` array.
See [meta-instructor README](workspaces/meta-instructor/README.md).
