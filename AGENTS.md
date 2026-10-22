# Agent instructions — CommandLine

## Repository bootstrap
Repository: `BestNameYet/CommandLine`.
Read the repository `README.md` and this `AGENTS.md` before repository work. Read any applicable workspace `AGENTS.md` and workspace README. These initial documentation reads may use the connected GitHub file-reading integration; once the command terminal is located, use it for supported repository operations.

## Find the active terminal through the GitHub integration
The canonical, exact Issue title is **CommandLine Bootstrap — Command Terminal**. Its Issue number is not fixed.

1. Use the connected GitHub integration's `search_issues` operation, scoped to `BestNameYet/CommandLine`, open Issues, and that title. Verify the selected Issue's title matches exactly and its state is open. If more than one matches, do not guess.
2. Read its Issue description for bootstrap context, without fetching all comments.
3. Use the integration's `add_comment_to_issue` operation to submit commands to that Issue. Its `pr_number` argument accepts the discovered **Issue number**; `repo_full_name` is `BestNameYet/CommandLine`.
4. Save the resulting GitHub **comment ID**. Retrieve only that individual comment using the integration's general `fetch` operation with `https://api.github.com/repos/BestNameYet/CommandLine/issues/comments/{comment_id}`, rather than `fetch_issue_comments` (which reads every comment).
5. The workflow appends command results to the **same originating comment**. Verify each nonce's result there before claiming success.

These GitHub integration Issue operations are the control plane: issue search, reading the bootstrap Issue, posting command comments, and retrieving individual comment receipts. They are not replacements for the repository command runner. For supported repository reads/writes, submit commands to the Issue terminal rather than bypassing it with direct GitHub file mutation APIs.

## Command envelope
A command comment begins with the exact marker on its own line followed by JSON:

```text
<!-- github-command-surface:v1 -->
{"statements":[{"k":"command","v":"local/read","nonce":"unique-example-nonce"},{"k":"parameters","v":{"path":"README.md"},"nonce":"unique-example-nonce"}]}
```

Each distinct command uses its own nonce. A comment may contain multiple commands; commands execute FIFO by first nonce appearance, unless an `ordinal` array overrides order. All outputs are appended to the originating comment, never a separate receipt comment for successful commands. The source code is authoritative about edge cases and nonce enforcement; do not assume an untested exactly-once guarantee.

Use the zero-argument `catalog` command to request the operation catalog; `help` provides the path `src/command-catalog.json`. `local/read` reads small checked-out files. Do not fetch all Issue comments as a routine discovery method.

## Workspaces and safety
Keep workspace-specific work isolated. For the API-to-Node.js conversion, see `workspaces/api-to-nodejs/README.md` and the applicable workspace instructions. Do not promote changes into shared `src/` or workflows without explicit authorization. Register substantive tracked file changes in `config/file-metadata.json`. Keep credentials in GitHub secrets, never in command comments or rendered output.
