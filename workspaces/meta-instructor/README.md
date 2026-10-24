# Interactive meta-instructor

Deployment status: installed through the authorized GitHub integration and Issue 6 commit adapter. A live start and schema-rejection check succeeded. The application workflow passed all 54 controller and existing console regression tests.

This application is controlled through the existing Issue 6 fixed gh> input.
All application code lives in workspaces/meta-instructor/. The minimal router
and workflow registration lives in the existing repository integration paths.

## Commands

1. Create an Issue 7 comment containing exactly {"problem":"Your task here"}.
2. Edit fixed Issue 6 input comment 6358997143:
   gh> meta start YOUR_UNIQUE_NONCE TASK_COMMENT_ID
3. Read the Issue 7 responseCommentId selected by this session's start command.
   Its `outputs` array contains successive requests and their returnSchema values;
   its `state` contains the canonical context and current phase.
4. Put the agent response JSON in an Issue 7 comment, then submit:
   gh> meta respond YOUR_UNIQUE_NONCE RESPONSE_COMMENT_ID
5. Recover the current request without advancing:
   gh> meta status YOUR_UNIQUE_NONCE

Issue 7 source comments may be owner-authored or created by the standard
command workflow. A successful gh-command-result whose stdout is the JSON
object is also accepted. The standard console can create input comments:
gh> issue comment 7 --repo BestNameYet/CommandLine --body 'YOUR_JSON_OBJECT'

No remote model service is assumed. The agent reading the request answers it,
executes each explicitly authorized step with its own available tools, stops,
and submits the report. This script orchestrates the conversation; it does
not itself execute arbitrary agent-written code.


## Session-owned output location

Each `gh> meta start NONCE COMMENT_ID` selects **one new Issue #7 comment ID**
for that session. It is *not* a global or hardcoded output comment ID.
For later `respond` and `status` commands with the same nonce, the adapter
retrieves that session comment and **PATCHes the same ID**. Its `outputs`
array receives the new output after all previous outputs. The Issue #6
`responseCommentId` continues to identify that same session-owned output.
Two sessions with different nonces maintain independent comment IDs and
separate output histories. The one shared Issue #6 input is only a command
submission surface, not a common output location.

The comment stores the authoritative `state` once. Individual `outputs`
contain compact requests (instruction, authorization and returnSchema) without
copying the full `request.context` into every output; the context remains
inspectable in `state`. Existing sessions with a legacy single `request`
are converted to an initial history entry on their next successful update.
A rejected agent response appends a validation-failure output without
advancing state. An unknown/invalid command that has no identifiable session
may still produce an independent error comment. If GitHub refuses a write,
the program cannot claim the attempted output was persisted.

## Protocol

Every nonterminal request includes a strict JSON Schema returnSchema:
{"nonce":"YOUR_UNIQUE_NONCE","requestId":"COPY_CURRENT_REQUEST_ID","payload":...}
Copy both exact values. Extra fields, wrong IDs, stale responses, wrong
types, empty text and invalid arrays are rejected without advancing state.

Phases:
- questions: payload is an array of {id,question,purpose,required}.
- answers: payload is an array of {id,answer,evidence}; answer every pending
  question. Evidence is an array of {reference,observation}.
- context: payload is {ready,reason,questions}. ready=false requires fresh
  follow-up questions; ready=true requires an empty questions array.
- plan: payload is an array of at least FIVE {id,title,action,explanation,
  expectedEvidence}. Every explanation requires at least 100 words.
- execute: payload is {stepId,status,summary,evidence,blockers}.
  status is completed or blocked. Completed requires evidence and no
  blockers. Blocked requires blockers and never unlocks the next step.
- report: payload is {report,evidence}; report requires at least 500 words.
- complete: terminal request has returnSchema {"type":"null"} and accepts
  no additional responses.

Only one plan step is authorized at a time. Every accepted response increments
the request revision. Schema validation failures preserve the current request.
All question-and-answer pairs are kept together in the state's qa JSON array.
Context assessment decisions, plan, step reports and final report persist in
a bot-authored Issue 7 session comment. Nonces are unique per session.

## Validation limits

Word counting uses Node Intl.Segmenter and counts word-like segments.
x-minWords is a JSON Schema extension explicitly enforced by the controller.
IDs, titles and action strings must be unique after Unicode NFKC, case and
whitespace normalization. This cannot prove semantic uniqueness.
Evidence references and agent assertions are recorded, not independently
verified. The okay-to-continue gate establishes structural compliance, not
proof of external execution. Context sufficiency is an explicit agent
assessment with follow-up rounds, not an omniscient automated judgment.

Storage: up to 30 questions per round, 100 total QA records, eight follow-up
rounds, 50 plan steps and 150 step reports remain controller-defined limits.
The previous application-specific 60,000-byte cutoff is removed. GitHub's
actual issue-comment/API limits still apply; failed writes cannot be presumed saved.
After a publication interruption, use status to recover the durable request.
Do not reuse a nonce for a new task. Do not submit the next fixed-input
command until the previous receipt is published and the prompt resets.

## Verification

node --test workspaces/meta-instructor/controller.test.cjs tests/issue6-gh-command.test.cjs tests/issue6-route.test.cjs tests/issue6-commit.test.cjs

The reusable meta workflow runs these checks before processing a command.
The existing listener owner, fixed-input and stale-event gates are retained.
Application workflow needs contents:read and issues:write only; it does not
commit files. Repository writes continue through the separate commit adapter.


## Manager-mediated execution (Issue #7 enforcement proposal)

The controller grants only one plan step at a time. A plan step can declare
`allowedOperations` and optional `readOnly`. Its grant is bound to the
session nonce, requirement generation, active step ID, and state revision.
The authorization object is a state locator, **not a bearer secret**; the
trusted Issue #6 owner/event gate and current persisted state are validated
before each mediated operation.

Available managed operations are:
- `issue.read`: `{"issueNumber":7}` — read a repository issue.
- `comment.read`: `{"commentId":123}` — read a repository issue comment.
- `repository.read`: `{"path":"README.md"}` — read an ordinary repository file.
- `issue.comment`: `{"issueNumber":7,"body":"..."}` — create an Issue #7 comment.

The manager cannot intercept ordinary ChatGPT tools, external browser activity,
direct tool calls outside this route, or file changes made through the separately
authorized commit adapter. Those paths are **not enforced** by this manager.
Managed write access is restricted to Issue #7 comments; Issue #6's input and
repository file writes are not controlled by `meta action`.

### Execute a managed action

1. Read the current request from this nonce's persistent Issue #7 session
   comment. Find `authorization.grant` and `ui.permittedOperations`.
2. Create an Issue #7 source comment with the action JSON below (use
   the values of the **current** grant, not values from an older output).
3. Edit fixed Issue #6 input to `gh> meta action NONCE ACTION_COMMENT_ID`.
   Read the latest appended session output, its receipt record in `state.receipts`,
   and the new revision before attempting any other action.
4. When finished with this step, use `gh> meta pause NONCE`. Only then
   submit the `execute` report using `gh> meta respond NONCE RESPONSE_COMMENT_ID`.
   A completed managed step needs a successful, same-step executor receipt
   cited as `receipt:<receipt-id>` in its evidence array. A failed action
   cannot satisfy completion. A blocked report holds the current step.
   Use `gh> meta resume NONCE` only after a blocked report to authorize
   corrective actions within that **same** step.

```json
{
  "nonce": "YOUR_NONCE",
  "generation": 0,
  "stepId": "CURRENT_STEP_ID",
  "revision": 4,
  "operation": "issue.read",
  "args": {"issueNumber": 7}
}
```

### Revise task requirements

Create an Issue #7 source comment containing
`{"problem":"Revised full task","reason":"What changed","restartAt":"questions"}`
and submit `gh> meta revise NONCE COMMENT_ID`. Use `restartAt:"plan"`
only when the existing QA still suffices. The controller retains the
superseded generation in its session history, invalidates old grants,
and returns to the requested phase. Revisions affect only the supplied nonce.

### Receipt and execution boundaries

`meta action` checks the current grant **before** issuing its Node-backed
GitHub operation. The executor records the actual response or failure, not an
agent-authored success claim. The persisted receipt carries the nonce,
generation, step, revision, source comment and operation. The current-step
report gate checks those records before allowing advancement. Receipt
validation attests to execution through this adapter; it does not establish
the accuracy of an agent's independent research or the completeness of a
large real-world objective.

`meta pause` suspends further managed tool actions; a valid step report
advances exactly one plan step. An invalid report leaves the current request
and next-step lock unchanged. An accepted blocked report keeps its step
locked until corrective action and a subsequent accepted completion report.

### Conversation visibility

Every output appends a compact `ui` instruction to the same per-session
Issue #7 output comment. This includes phase, current step, pause gate,
permitted operations, and next required response. The linked Issue #7 comment
is the persisted authoritative UI source. This GitHub workflow cannot
automatically inject a new message into an existing ChatGPT conversation;
a ChatGPT agent can surface the linked current instruction in its own reply.

### Verification and limits

Run `node --test workspaces/meta-instructor/controller.test.cjs tests/issue6-gh-command.test.cjs tests/issue6-route.test.cjs tests/issue6-commit.test.cjs`
through the documented Actions workflow. Test allowed and denied
operations, stale/cross-session grants, successful/failed receipts,
pause/report/resume, requirement revisions, and session output isolation.
No additional arbitrary storage, question, step, or reporting limits are
introduced by this enforcement layer. Actual GitHub comment/API limits remain.
