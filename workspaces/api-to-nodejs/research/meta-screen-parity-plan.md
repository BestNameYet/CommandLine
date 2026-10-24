# Meta procedure-screen parity: verified gaps and implementation plan

Job: job-008. Design proposal, not implemented. Date: 2026-10-24.

## Goal and constraints

Reimplement the latest StateMachines issue-rendered procedure functionality in CommandLine's meta structure while retaining the central Issue #6 intake / Issue #7 queue, nonce-specific state, owner-only authorization, receipts, and workspace isolation. Current job authorization covers investigation and preparation; this document makes the implementation reviewable.

Reference commit: BestNameYet/StateMachines 6ad9089083248ab3b9ed9d2fb91a9bc810345c0b.
Reference directory: ChatMachines/Workflow Interactive Procedures/AGENTS Procedure/.
CommandLine inspected controller blob: b6e79083bb061df483a5ff26ec1a7e8055190007; adapter blob:095484da2f22859e95c0aeaeae8077b9ff351e0f.

## Verified comparison

| Capability | StateMachines reference | Current CommandLine meta | Required change |
| --- | --- | --- | --- |
| Invocation | Fresh issue/run, owner input, saved request | Issue6 meta commands, one Issue7 comment/nonce | Dedicated procedure input surface for queued jobs; never send work commands to queue-only Issue6 |
| Normal procedure | Compiled transitions, positional normal renderer, 24 renders | Fixed questions/answers/context/plan/execute/report phases | Preserve current lifecycle while adding reference procedure engine, explicit mode and request identity |
| Generated mode | Gemini generates validated screens and controls | Agent answers fixed controller schemas | Add template-backed provider boundary, correction attempts and saved screens |
| Mirror mode | Owner supplies control/instruction/expectedInputs without Gemini | Absent | Add producer and consumer phases; block replacement/completion with outstanding returns |
| Returns | Exact stored names/schema, typed variable returns | Strict nonce/requestId/payload schemas | Add schema-driven screen return adapter without weakening existing controller contracts |
| Persistence | Per-issue record, SHA-based saves, input/publication history | Per-nonce state and append-only outputs in Issue7 | Retain session ownership; separate accepted state, rendered screen and publication receipt |
| Navigation | state/back/retry do not advance | status recovers compact request | Add explicit navigation and recovery, with no generation side effect |
| Variables/screens | Append-only name/value and exact screen arrays | QA, plan, reports, receipts | Add chronological screen and variable histories; preserve repeated names |
| Control | Target/current, outcome/process gaps, progress | Context ready and completed/blocked report | Store validated controls; distinguish completion and three-turn generated-mode stall |
| Workers | Shared rules, independent nonces/returns, prepared work and context reconstruction | No broadcast worker subsystem | Add isolated worker state/assignment/replay; max one ChatGPT and three Gemini in reference |
| Files | Isolated issue workspace, manifest, staged operations and before/after receipts | Four managed GitHub operations; no repository write | Add authorized workspace adapter with intent/receipt/recovery; root access remains separately authorized |
| Execution reports | Certain transitions require committed tool invocation reports | Managed actions require same-step successful receipts | Preserve strict receipts and add reference report artifacts where required |
| Completion | Preserve final state and close run issue | Final report transitions session to complete | Keep completion evidence distinct from structural acceptance; no agent claim becomes execution proof |

Source evidence: reference README, issue-workflow.js, transitions.json, gemini-workflow.js, mirror-workflow.js, supervisor-tools.js and corresponding tests. Current controller.cjs and issue6-adapter.cjs were read directly. Source review is not a fresh passing test run.

## Approaches and proposed design

A renderer-only addition would leave mode, recovery, worker and workspace behavior missing. Replacing the current controller would discard its established managed-action grants and session receipts. Proposed approach: retain that controller and isolate the reference procedure engine behind an explicit application adapter under workspaces/meta-instructor/, with queue-linked procedure sessions and shared receipt checks. This is the builder's proposal, not a recorded user selection.

Use a dedicated owner-only procedure issue marker bound to a saved central job and a unique session nonce. Issue6 remains queue updates only. For new procedure sessions, the canonical state is workspaces/meta-instructor/procedure/issue-runs/<issueNumber>.json. It contains schemaVersion, jobId, nonce, issueNumber, revision, outputCommentId, expectedInputs, acceptedCommentIds, publicationIntents and publicationReceipts. Save using the current Git blob SHA; retry after a conflict only after rereading and rejecting stale input. A nonce index maps to that issue number and original outputCommentId, but never duplicates session state. Issue7 outputs are published projections with state path/revision locators. State and index writes are separate, not atomic: write state first, recover a missing index by exact nonce/job binding, and reject conflicting bindings. Existing meta-instructor-session comments remain authoritative for their legacy controller sessions; retain their IDs/histories and dispatch them through the legacy adapter. Do not silently migrate or fork a legacy session.

Normal mode uses the reference transition contract; Gemini mode delegates only screen/control generation; Mirror mode accepts supplied screens without a model call. Deterministic code owns authorization, validation, state, readiness and publication. Generated semantic completion remains a model assessment, never proof of task success. Reuse current managed receipts for allowed operations.

## Implementation plan

For agentic workers: use the executing-plans or subagent-driven-development skill after design review. All application changes must first have claimed queue steps; record each file change immediately.

**Tech stack:** Node.js CommonJS, built-in node:test/assert, existing GitHub Actions/integration and provider abstraction. No new framework required.

**Global constraints:** Queue intake before work; owner-only event checks; distinct job/worker/session nonces; workspace allowlist; preserve original prompts; no future-step grants; no completion without verified receipts; workflow candidate/live bytes must have equal Git blob SHAs.

### Task 1: Add the isolated procedure engine and state contract

Files under workspaces/meta-instructor/procedure/: state.cjs, schemas.cjs, normal.cjs, fixtures/ and engine.test.cjs.
Interface: createSession({jobId,nonce,issueNumber}) -> session at reference render24; applyInput(session,input) -> new session; currentScreen(session) -> {requestId,instruction,expectedInputs}; no API side effects. Collect mode interactively at render24, then exact prompt at render1; only afterward start the selected engine. Existing sessions continue at their saved request without retroactive initialization.
- [ ] Add failing lifecycle tests for normal reference branches, wrong names/types, repeated render with new request, stale request, duplicate input and legacy session preservation.
- [ ] Port the pinned reference transitions/render contracts and retain explicit provenance.
- [ ] Run node --test workspaces/meta-instructor/procedure/engine.test.cjs; require zero failures.

### Task 2: Add Mirror and generated screens

Files: mirror.cjs, generated.cjs, provider.cjs, template.json and screens.test.cjs.
Interfaces: acceptProducer(session,{control,instruction?,expectedInputs?}); acceptReturns(session,values); generateNext(session,provider). All return candidate state; persistence remains separate.
- [ ] Test outstanding-return rejection, publication prerequisite, exact schemas, reserved envelope name, repeated-variable history, unsupported schema keywords and control-only completion.
- [ ] Test up to three malformed-response corrections, accepted variables surviving provider failure, baseline not counting as a stall, navigation/retry not counting, third accepted no-progress turn producing incomplete status. Assert complete append-only screen/value/control replay. Supervisor sees file bodies only from its own explicit read_files; worker reads, write bodies and cached worker files retain metadata with contentOmitted:true. Test commands-only exchanges save intent/results, recall provider with updated state, preserve current screen, recover without reexecuting completed commands and do not count as operator stall turns.
- [ ] Implement from the reference behavior; run screen tests and existing controller tests.

### Task 3: Add durable owner-only transport and recovery

Files: procedure-adapter.cjs, persistence.cjs, publication.cjs and adapter.test.cjs.
Interfaces: loadSession(locator), saveSession(expectedVersion,next), publishScreen(savedSession) -> receipt; handleEvent(event,api) rejects unqueued/unbound jobs and unauthorized actors before side effects.
- [ ] Test two concurrent nonce/issue sessions, optimistic-save conflicts, index-write failure after state save, legacy session dispatch, failed publication, success followed by failed receipt save, retry deduplication, state/back navigation and preserved request. Preflight complete comments including wrappers against65000 characters; fail without truncation. Bound/split state display. Broadcast A/B/C parts need separate receipts and no returns become available until all required parts publish.
- [ ] Persist intent before execution, state before publication, and receipts afterward. Document the unavoidable publication/save crash window.
- [ ] Run adapter and existing console/controller regressions.

### Task 4: Add workspace, workers and invocation reports

Files: workspace.cjs, workers.cjs, invocation-reports.cjs and their tests.
Interfaces: executeWorkspaceAction(grant,action), prepareWorker(session,assignment), applyWorkerReturn(session,nonce,values), recordInvocation(session,receipt).
- [ ] Test traversal and root-denial, missing/read-only grants, before/after hashes, interrupted operation recovery, independent worker nonces, repeated delivery, prepared-work replay and wrong worker return. Require immediate prepared delivery before other registrations, one pending assignment per nonce, run-wide unique assignment IDs, next<nonce> preserving other unfinished assignments, partial broadcast recovery, failed-worker retry preserving accepted workers, and baseline plus ordered set/delete/append reconstruction. For normal renders13/17 reject comment returns and require a committed issue-bound per-run invocation report; invalid append leaves screen unchanged, cumulative loop reports persist, accepted markers suppress replays, and renders14/18 link the artifact without embedding it.
- [ ] Port reference inventory/read/write/standing-rule semantics into the existing granted-action boundary. Do not grant arbitrary filesystem or remote access.
- [ ] Verify all four reference normal paths and worker lifecycle fixtures.

### Task 5: Register workflows, documentation and acceptance evidence

Files: workspaces/api-to-nodejs/workflows/<new-procedure-workflow>.yml and matching .github/workflows file; deployment.json; README.md; VERIFICATION.md; config/file-metadata.json.
- [ ] Save candidate first; promote through GitHub integration; read both and require equal blob SHAs. Do not send application execution through Issue6.
- [ ] Run all new tests plus existing controller/console regressions; include Mirror tests in workflow checks/path filters (the reference workflow currently omits these).
- [ ] Run live owner-only normal/Mirror multistep acceptance, malformed/stale input, session isolation, retry/resume and completion with saved receipts. Run live Gemini only when the configured credential/provider is available; otherwise record that acceptance item blocked.
- [ ] Read final code, workflow hashes, test logs and issue outputs; update the queue per file and conclude only the verified scope.

## Review focus

Concurrent saves must not overwrite other sessions. An unpublished screen must not accept returns. Failed provider calls must preserve accepted values. Retried side effects need durable intent/receipt matching. Replayed or cross-session nonces must never authorize another session.

## Status and next action

Reference discovery is complete. Gap analysis and plan are prepared. Product code, dependencies, workflow registration and live tests have not been changed. Review this design before starting implementation; existing meta command routing also needs reconciliation with the newer queue-only rule rather than silently bypassing it.

## Builder review disposition

Read-only reference review identified seven material gaps. This revision resolves canonical storage/migration, interactive initialization, worker scheduling/reconstruction, supervisor content filtering, invocation-report transport, comment sizing/publication splits, and commands-only recovery. These are design/test requirements; none is an execution claim.
