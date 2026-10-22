# Runner API-to-Node mapping audit

Verified existing behavior in `src/issue-command.js`: `local/read`, `local/stat`, `catalog`, and `help` run locally. All other 1,174 catalog operations still use `fetch` through `requestFor`.

| Operation | Candidate | Decision |
|---|---|---|
| `repos/get-content` | `fs.readFileSync`, `fs.readdirSync`, Git object hashing | Stage local adapter for clean checked-out HEAD only |
| `repos/get-readme` | Local README discovery and content read | Stage local adapter for clean checked-out HEAD only |
| `git/get-blob`, `git/get-tree` | `git cat-file`, `git ls-tree` | Possible for objects present locally; not yet implemented |
| `git/get-ref`, `git/get-commit` | `git rev-parse`, `git cat-file` | Possible for local objects; not yet implemented |
| Repository writes | `fs` plus `git add/commit/push` | Not equivalent to individual GitHub REST mutations without branch/conflict/permissions safeguards; not yet implemented |
| Issues, permissions, actions, hosted metadata, organization resources | Remote GitHub state | Keep authenticated GitHub control/API execution |

The staged `local-repository-adapter.js` is not wired to production. It deliberately rejects dirty trees, non-HEAD refs and oversized files instead of silently returning an incorrect substitute. Directory and file output fields cover a subset of REST content shape; production integration must validate response compatibility and test symlink protections, race conditions, permissions, and Git SHA semantics. The runner's issue nonce checks and publisher remain API-dependent by design.

Validation command within the workspace: `node workspaces/api-to-nodejs/local-repository-adapter.test.js`.
