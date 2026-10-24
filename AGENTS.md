# Agent instructions — CommandLine

## Central job queue — required

### Every user order must enter through Issue #6

**An agent must not implement a user work order directly from the conversation. Every user order must first be issued or recorded through Issue #6 so that it is added to the central Issue #7 job queue.** This applies to new work, fixes, documentation edits, workflow changes, and later instructions that change existing work.

1. Record the verbatim user prompt, interpreted intent, and submission nonce in a new job record, or append a follow-up prompt to its existing job record, using an Issue #6 queue-update command.
2. Inspect the command's execution receipt and reread the central Issue #7 comment to verify that the order was actually saved. Submitting the command alone does not satisfy intake.
3. Only after that verification may an agent take the next available unfinished step from the saved job and begin implementation using the authorized tools. Assignment remains per step, with a separate worker nonce.

Direct file edits, commits, API calls, integrations, or runtimes must not be used to implement an unqueued order. They may be used to carry out an already recorded job under the applicable execution and workflow rules. Preserve the original prompt and submission nonce; record later user instructions before implementing their changes.

**All agents receive their jobs from the single [Issue #7 job-queue comment](https://github.com/BestNameYet/CommandLine/issues/7#issuecomment-6389130786) (comment ID `6389130786`).** Read that exact comment before selecting or resuming work. Keep all jobs and their completion statuses in its JSON `jobs` array; update the same comment throughout each job.

**Issue #6 is only for updates to this central Issue #7 queue.** Add or revise jobs and update their progress there; do not submit the actual work itself to Issue #6. Agents read their assignments from Issue #7 and perform the assigned work using the appropriate authorized integration or runtime. This rule supersedes older direct-work submission instructions and examples below, including direct `gh> commit` and `gh> meta` submissions. Those sections describe existing runner capabilities, not permission to bypass the queue.

The central comment stores one `return_schema` and one `jobs` array. Each job is **one record for its entire lifecycle**, with this complete form:

```json
{
  "id": null,
  "user_prompt": null,
  "user_prompt_updates": null,
  "user_intent": null,
  "submission_nonce": null,
  "status": null,
  "progress": null,
  "job_plan": null,
  "job_actions": null,
  "files": null,
  "completion": null,
  "additional_information": null,
  "updated_at": null
}
```

Every field stays present. Any value not yet known, populated, or completed is `null`; do not invent missing values or use placeholder claims. Use an empty array only when it is known that there are no items. The formal `return_schema` in comment `6389130786` defines the nested shapes.

- **At submission:** copy the user's prompt exactly into `user_prompt`, record interpreted `user_intent` separately, and generate a `submission_nonce`. Preserve that original prompt and nonce; append later user instructions verbatim to `user_prompt_updates`.
- **Plan and assignment:** `job_plan` is an ordered array of steps, each with `id`, `description`, `status`, `worker_nonce`, and `result`. **Assignment is per step, never per job. Any agent may complete an unfinished step that is available, and must take the next available step in plan order.** An available step is unfinished, ready to perform, and not currently being worked by another agent. A worker records a fresh nonce on the step, distinct from the submission nonce and other step assignments. Mark the step `in_progress`, finish or report its blocker, and update its result/status in the same job record. A takeover uses a new worker nonce; keep prior action/change records as history. Do not reserve every step or the entire job for one agent.
- **Actions:** `job_actions` entries contain `id`, `plan_step_id`, `worker_nonce`, `description`, `status`, `result`, `comment_id`, `path`, and `evidence`. Associate each performed action or update with its Issue comment ID and/or repository file path. Keep unavailable references null.
- **Files:** `files` entries contain `repository`, `path`, `operation`, `status`, and `changes`. Record files intended for creation or modification in the plan. **Immediately after each actual file creation or change, update that file entry and append a change record; do not wait until the whole job ends.** Each change records `plan_step_id`, `worker_nonce`, `description`, `changed_at`, `comment_id`, `receipt_comment_id`, `path`, `commit_sha`, `blob_sha`, and `evidence`. Include the associated comment ID and/or file path, and record hashes or receipts only when verified. All unavailable values remain null.
- **Conclusion:** `completion` contains `summary`, `validation`, `remaining_work`, and `evidence`. Fill it when the job concludes, while retaining all steps, actions, file changes, and references in the same record. Keep other pertinent details in `additional_information` and refresh `updated_at` after each saved change.

Use `pending`, `in_progress`, `blocked`, or `completed` for known job/step/action/file status; `progress` is a completion percentage from 0 to 100, or null when unknown. A completed step does not complete the entire job. Mark a job completed only after its required steps and results are verified. Retain completed jobs in the central comment.

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
