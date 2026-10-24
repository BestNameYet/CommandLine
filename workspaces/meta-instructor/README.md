# Interactive meta-instructor

Deployment status: installed through the authorized GitHub integration and Issue 6 commit adapter. A live start and schema-rejection check succeeded. The application workflow passed all 54 controller and existing console regression tests.

This application is controlled through the existing Issue 6 fixed gh> input.
All application code lives in workspaces/meta-instructor/. The minimal router
and workflow registration lives in the existing repository integration paths.

## Commands

1. Create an Issue 7 comment containing exactly {"problem":"Your task here"}.
2. Edit fixed Issue 6 input comment 6358997143:
   gh> meta start YOUR_UNIQUE_NONCE TASK_COMMENT_ID
3. Read the resulting Issue 7 responseCommentId. It contains a request,
   a complete returnSchema and a sessionCommentId.
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

Storage: at most 60,000 UTF-8 bytes per session comment; up to 30 questions
per round, 100 total QA records, eight follow-up rounds, 50 plan steps and
150 step reports. Exceeding limits fails without saving the proposed state.
After a publication interruption, use status to recover the durable request.
Do not reuse a nonce for a new task. Do not submit the next fixed-input
command until the previous receipt is published and the prompt resets.

## Verification

node --test workspaces/meta-instructor/controller.test.cjs tests/issue6-gh-command.test.cjs tests/issue6-route.test.cjs tests/issue6-commit.test.cjs

The reusable meta workflow runs these checks before processing a command.
The existing listener owner, fixed-input and stale-event gates are retained.
Application workflow needs contents:read and issues:write only; it does not
commit files. Repository writes continue through the separate commit adapter.
