# Cross-repository idea and technique inventory procedure

Job: job-007. Scope: BestNameYet/MCP-Collaborative and BestNameYet/StateMachines. Date: 2026-10-24.

## Existing work and authority

No procedure specifically covering this cross-repository inventory was identified in the searched current trees, targeted documentation, Issue #7 comments, and supplied leads. This is a bounded search result, not proof that no deleted or archived procedure exists.

Reuse the evidence and checkpoint principles in [the prior GeminiSupervisor feature inventory](https://github.com/BestNameYet/StateMachines/blob/6ad9089083248ab3b9ed9d2fb91a9bc810345c0b/ChatMachines/GeminiEvaluation/evaluations/stage1_current_feature_inventory_20261002_1/evaluation.json) and its sibling config.json/run-stage1.js. That run covers GeminiSupervisor, not both repositories. Its execution/final.json records a historical complete result with 41 features; preserve those results as prior evidence, without claiming a fresh rerun or adopting every feature as currently verified.

## Execution and checkpoints

1. Read repository README/AGENTS and applicable project documentation. Record missing documents as observed 404s. Read the canonical queue and claim only the next available step with a distinct worker nonce; parent/coordinator serializes queue writes through Issue #6.
2. Resolve each default branch to a commit and fetch its complete recursive Git tree through the authorized GitHub integration. Record commit, tree, entry count and truncated flag. Stop a completeness claim if pagination/tree truncation is unresolved.
3. Classify paths into active implementation, normative/design documentation, tests, prior runs/evaluations, archives/generated/vendor data. Preserve the path ledger and state explicit exclusions. Duplicate copies are evidence of variants, not independent ideas.
4. Review documentation and entry points by subsystem. For each candidate idea record a stable ID, name, problem, mechanism, repository/ref/path/symbol or exact excerpt, related IDs, and distinctions from similar ideas. Follow implementation references rather than inferring behavior from titles.
5. Label each claim separately: proposed/specification; source-implemented; test-defined; historical-result; live-verified; rejected/superseded; or unknown. A source implementation is not an end-to-end verification. Document contradictory definitions instead of silently picking one.
6. Iterate over unreviewed relevant subsystems. After each batch, save the inventory/coverage checkpoint, source references, open questions, rejected duplicates, and next action. Update changed file entries immediately with verified commit/blob references. On resumption reread artifacts and continue from that checkpoint.
7. Consolidate by mechanism, retaining repository-specific refinements and attempted control mechanisms. Record dependency/idea relationships and explicitly distinguish persistence, projection, orchestration, authorization, evaluation and execution receipts.
8. Verify coverage against the tree classification and every intended subsystem. Recheck primary sources for substantive conclusions, validate structural uniqueness and mandatory evidence fields, and record evidence gaps. Do not mark comprehensive historical coverage when issue/archive/deleted-history review remains incomplete.
9. Publish the inventory with the source/ref ledger, prior-progress references, coverage matrix, findings, exclusions and remaining work. Read the durable result back. Complete the job only if its stated coverage is satisfied; otherwise report the exact blocker or pending scope.

## Record contract

Each idea record carries: id; name; repository; ref; subsystem; problem; mechanism; status_labels; evidence (path, symbol/section, observation, URL); refinements; related_ids; uncertainty. Unknown values are null. No invented origin dates, execution results, or semantic-success claims.

Each coverage row carries repository/ref, subsystem/path group, disposition (reviewed, preserved prior, excluded with reason, or pending), source list and limitations. Completion requires no unexplained pending relevant group and an explicit disposition for historical/archive scope.

## Initial checkpoint

- MCP-Collaborative main commit: 05ee655375695fbf48e0eeaab5ef2c561a565f78; tree: 976e684c3841ab2313dfe476cfa9037962d1cdb9; 52 tree entries, truncated:false.
- StateMachines main commit: 6ad9089083248ab3b9ed9d2fb91a9bc810345c0b; tree: e1899f7c84bcdae126a58153e1a86f1ed37844e0; 2860 tree entries, truncated:false.
- Issue #7 leads 6380962351 and 6380987413 contain related documentation and code, not a confirmed cross-repository inventory procedure.
- Root MCP README/AGENTS and StateMachines AGENTS were absent at inspection; relevant existing subsystem READMEs govern their respective work.
