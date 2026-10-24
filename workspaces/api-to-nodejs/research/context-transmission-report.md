# GitHub Issues as Context Transmitters

Job: job-009. Research date:2026-10-24. Historical dates below are UTC. The study uses primary repository files, commit diffs/timestamps, issue comments and current tool-return observations.

## Finding

The strongest supported sequence is persistent actor views, explicit dialogue replay, issue-rendered context, full saved-state replay, then worker reconstruction. Related ideas were documented in MCP-Collaborative by August30,2026. An explicit StateMachines decision to replay prior Gemini messages is recorded October7; full-state screen-generation replay was specified and wired October17. This establishes dated observations and adoption points. It does not prove the original human conception date or a causal transfer between repositories.

## Issues6,7 and8: the current mechanism

| Surface | Stored content | Retrieval role |
| --- | --- | --- |
| Issue6 | Owner-edited CLI inputs plus command/result references | Points to the exact Issue7 responseCommentId; current README/AGENTS restrict new use to central queue updates |
| Issue7 | stdout/stderr/exit receipts, source file objects, nonce session state/outputs and central job queue6389130786 | Tool reads return the durable JSON/text payload; individual-comment reads can select one authoritative record |
| Issue8 | Two source-bearing JSON arrays, despite a gas-model research title/body | Mandatory project-instruction retrieval exposes runtime/controller source and workflow YAML to the reader |

The current runtime/issue6-gh-command.cjs (blob21a7e7815ca847acd5ddc09eb80f00ea6f646aa9) parses the selected command, runs spawnSync('gh',args) with shell:false, a90000ms timeout and1048576-byte maxBuffer, records the actual exit code/stdout/stderr, publishes that result to Issue7, publishes responseCommentId on Issue6 and only then resets the input. This is the implemented transport, not proof that every submitted command succeeded. Successful live queue-update receipts in this study include6391067138,6391073045,6391084957 and6391092541.

Canonical sources: [runtime](https://github.com/BestNameYet/CommandLine/blob/main/runtime/issue6-gh-command.cjs), [queue](https://github.com/BestNameYet/CommandLine/issues/7#issuecomment-6389130786), [Issue8 source](https://github.com/BestNameYet/CommandLine/issues/8#issuecomment-6387635472), [Issue8 workflows](https://github.com/BestNameYet/CommandLine/issues/8#issuecomment-6387665174).

## Observed payload size and limits

Snapshot measurements sum JavaScript string.length of comment body fields. They are UTF-16 code units, not UTF-8 bytes or model tokens. Snapshots were retrieved during this study, not atomically across issues.

| Snapshot | Comments | Body code units | Largest examples |
| --- | ---: | ---: | --- |
| Issue6, before current queue updates |321|767789|6359048816:40850|
| Issue7, first400-comment snapshot |400|4426847|6380967261:144428;6380980284:132729|
| Issue8 |2|49306|6387635472:36260;6387665174:13046|

A later Issue6 retrieval returned324 comments; ongoing work changes totals. Issue7 was retrieved with100 records/page and an empty fifth page at that snapshot. The all-pages Issue7 connector attempt failed with Transport closed; paginated reads succeeded. The initial Issue6 all-comments return, including redundant rendered HTML, produced a tool display reporting about487298 tokens and was truncated. Issue8 full response also required bounded redisplay. These observations demonstrate substantial tool payload transfer and practical failure/truncation; they do not establish complete ingestion of every returned character.

The stages must remain distinct:

1. GitHub persists a body.
2. A runtime or connector selects and retrieves it.
3. A tool return exposes selected content to the assistant, possibly with duplicated HTML/metadata.
4. Output/context limits determine which text is actually available.
5. The assistant can reason only from content it received and inspected.

Storage does not automatically inject an instruction into an existing ChatGPT conversation. A forced or customary retrieval can expose content, but exposure is not proof of comprehension, obedience, semantic success, or unrestricted context capacity. The runner buffer is also separate from connector and model limits. This study did not measure the model's total context-window capacity.

## Dated idea timeline

| Date/time UTC | Evidence | Verified significance |
| --- | --- | --- |
|2026-08-30T13:40:51Z|[a26e143ead](https://github.com/BestNameYet/MCP-Collaborative/commit/a26e143ead38d587f82ad29d8beec63085d9b4e7)|specification: Profile standard requires persistent actor-visible environments and reconstruction guarantees.|
|2026-08-30T13:41:55Z|[78fe405665](https://github.com/BestNameYet/MCP-Collaborative/commit/78fe405665f46247a9b961d643a3a81ec8175f49)|specification: Actor current permitted view plus bounded history; accepted-event replay reproduces authoritative state.|
|2026-08-31T23:45:47Z|[d328e8f012](https://github.com/BestNameYet/MCP-Collaborative/commit/d328e8f012e1327bdca28db8960fb52daf2f59d1)|source-implemented: Environment retrieval tool and deterministic replay implemented.|
|2026-10-02T06:43:48Z|[03f755ee37](https://github.com/BestNameYet/StateMachines/commit/03f755ee37f7ecb02d22125ef989721915276b55)|documentation: Documents nonce-owned supervisor state/messages/audit and relevant-context dispatch.|
|2026-10-07T14:09:55Z|[a8d4458bbf](https://github.com/BestNameYet/StateMachines/commit/a8d4458bbf7d6b9dfd1ff1acef636d8eca12b2ed)|recorded-intent/repair: Explicit user requirement to reconsume authoritative prior Gemini messages; repair earlier abstract access.|
|2026-10-15T05:59:48Z|[3b12763304](https://github.com/BestNameYet/StateMachines/commit/3b127633041662e16e4677ceacfc1e60d6ed0721)|source-implemented: Issue renderer with request identity, saved state, returned values and snapshots.|
|2026-10-15 06:44:21 and07:18:17|[First rendered screen](https://github.com/BestNameYet/StateMachines/issues/7#issuecomment-6186195225), [next screen](https://github.com/BestNameYet/StateMachines/issues/7#issuecomment-6186714403)|Historical live publication: first screen includes original request, schema and state; next contains captured prompt “What does JSON stand for?” in saved state.|
|2026-10-17T15:01:47Z|[21a52d7a1c](https://github.com/BestNameYet/StateMachines/commit/21a52d7a1c31c6903893cb9b729f0aa0a59ec392)|specification: Explicit template decision: verbatim prompt, chronological screens and saved values.|
|2026-10-17T15:27:55Z|[1707ad24f1](https://github.com/BestNameYet/StateMachines/commit/1707ad24f1d01e894b6198c3f99f71eecc692cb5)|source-implemented: Serialize full saved state in each stateless Gemini request.|
|2026-10-17T17:55:57Z|[1b105cbc7f](https://github.com/BestNameYet/StateMachines/commit/1b105cbc7f1501f4ba1712ab3e9e2ec975a9abe9)|source-implemented: Worker baseline and ordered state-change reconstruction; ChatGPT uses comments/state/back.|

The October15 comment row is historical publication evidence; the other rows cite source/specification commits.

### Where the decision becomes explicit

The October7 requirements-spec.json records the user's concrete request to keep Gemini context-aware by including its former message in each reply package. It requires authoritative prior-response bytes, current request, governing context, dialogue state and unresolved obligations. The same commit's prior-failure-analysis says an earlier procedure already specified replay but left actual access abstract. Therefore October7 is a verified repair/adoption point, not a first-conception claim.

On October17, the template commit fixes the context payload: exact prompt, chronological screens and variables. The integration commit serializes saved state into contents[0].parts[0].text; the worker commit adds baseline and ordered set/delete/append reconstruction with prior worker results. Those are concrete architectural decisions and code changes. Current StateMachines documentation additionally filters file contents so supervisor context does not automatically include worker reads/write bodies.

## Comparison and refinements

| Mechanism | Authority and audience | Reconstruction | Distinct limitation |
| --- | --- | --- | --- |
| MCP-Collaborative actor environment | Server-authoritative game state; actor receives allow-listed projection | Current permitted view plus explicit bounded history; genesis/accepted-event replay reconstructs server state | Full server history and permitted actor context are deliberately different |
| GeminiSupervisor | Nonce-owned run state, messages and audit; supervisor receives relevant execution context | Persisted state-machine run resumes across calls | Documentary/implementation source does not itself prove current end-to-end execution |
| Context-rich dialogue procedure | Authoritative immediately prior Gemini response plus current obligations | Explicit message-package replay and handshake/receipt requirements | Earlier abstract-interface attempt was recorded as noncompliant |
| StateMachines issue screens | Saved per-issue run; owner inputs; rendered instruction/comments | Requests/history/snapshots and state/back navigation | ChatGPT needs tool retrieval; API replay is not automatically forwarded to ChatGPT |
| StateMachines Gemini/workers | Deterministic workflow owns state and visibility; model consumes packages | Full state/template replay and per-worker reconstruction queue | Stateless calls, payload growth, visibility filtering, credentials and publication/recovery limits |
| CommandLine Issues6–8 | Queue, receipts, sessions and source payloads in stable comments | Reread exact queue/session/source comment, using IDs and nonces | Broad reads can overwhelm transport/context; duplicate JSON wrappers inflate payload |

The relationship is architectural similarity, not proven direct descent. Both systems externalize state, distinguish permitted views from authoritative state, and use tool/API boundaries to reintroduce relevant context. Issue6 adds an auditable command entry and reference path; Issue7 consolidates results and durable work state; Issue8's mandatory source-bearing comments act as an explicit context delivery prerequisite.

## Coverage and evidence gaps

This study examined both named repositories and their relevant primary history, naming-variant searches, current CommandLine Issues6–8 and linked source. No independently substantiated additional repository was identified as an origin source. An identity-only Context Deep Dive project-history artifact was excluded because it says original conversations were not read and offers no verified milestones.

The actual original idea date, the earlier attempt mentioned October7, deleted history, every original conversation and a causal MCP→StateMachines handoff remain unresolved. These are reported research limits, not invented facts or unperformed implementation. Historical tests/README success statements were not rerun. New source/receipts were read directly; large tool outputs were filtered/paginated rather than described as fully ingested.

## Practical consequence

Keep stable source IDs, exact request/nonce bindings, compact selected retrievals, durable state and independent execution receipts. Preserve enough authoritative context for the next actor while explicitly enforcing visibility and output-size limits. The resulting system can transmit much more context than a short UI message, but reliable continuation depends on deliberate retrieval and validated state transitions.
