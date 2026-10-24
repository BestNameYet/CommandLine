# Issue #6 comment commit adapter

## Command

Edit the fixed owner-controlled input comment on [Issue #6](https://github.com/BestNameYet/CommandLine/issues/6#issuecomment-6358997143) to:

```text
gh> commit <commentID>
```

`commentID` must be the GitHub comment ID of a file object on [Issue #7](https://github.com/BestNameYet/CommandLine/issues/7). Do not post this command as a new comment or repeat `gh` after `gh>`.

## File object format

```json
{
  "filename": "workspaces/repository-reviews/example/README.md",
  "body": "# Example\n"
}
```

The referenced Issue #7 comment may contain the file object directly, or a successful `gh-command-result` wrapper whose `stdout` is the same JSON file object. A failed command result is not eligible.

The filename must be repository-relative, not absolute, and must not contain traversal, backslash, Git internals, or control characters. File content must be a UTF-8 string of at most 900,000 bytes.

## Workflow responsibilities

The [Issue #6 listener](../../.github/workflows/issue-6-gh.yml) calls the [preprocessor](../../runtime/issue6-route.cjs). For an authorized owner edit to input comment `6358997143`, it selects one route:

- Ordinary `gh>` commands and normalization: [read-only reusable workflow](../../.github/workflows/issue-6-standard.yml), `contents: read`, `issues: write`. The existing `runtime/issue6-gh-command.cjs` executor is retained.
- `gh> commit <commentID>`: [commit reusable workflow](../../.github/workflows/issue-6-commit.yml), `contents: write`, `issues: write`, invoking [runtime/issue6-commit.cjs](../../runtime/issue6-commit.cjs).

No ordinary `gh>` command receives `contents: write` through this routing architecture.

## Commit execution

The commit adapter checks the originating Issue #6 event and owner, parses the comment ID, re-reads the current prompt to reject stale input, retrieves the referenced Issue #7 comment and file object, and inspects the target file.

It creates a missing file, updates a changed file, or reports `unchanged` if the existing decoded bytes are identical. It requires a resulting GitHub commit SHA for actual writes.

The adapter publishes a `gh-commit-result` on Issue #7 with the status, filename, commit SHA, and any error, without echoing the full file body. It adds a reference comment on Issue #6 and resets the fixed prompt to `gh>`.

## Verification

Run the focused tests in a repository checkout:

```sh
node --test tests/issue6-gh-command.test.cjs tests/issue6-route.test.cjs tests/issue6-commit.test.cjs
```

The configured repository token and GitHub branch rules still determine whether an individual file mutation succeeds. Workflow-file commits may require additional GitHub permissions.
