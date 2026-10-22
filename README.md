# CommandLine

CommandLine is a workspace-oriented repository for developing isolated tasks, shared execution code, and automation. Workspaces can contain experiments or long-lived projects. Promotion of workspace changes to other paths is a separate, explicitly authorized operation; creating a workspace does not grant permission to publish outside it.

## Repository layout

| Path | Purpose |
| --- | --- |
| `workspaces/` | Segregated task and project working areas |
| `src/` | Shared implementation code and tooling |
| `config/` | Shared configuration and mandatory file metadata |
| `tests/` | Automated tests and fixtures |
| `runtime/` | Runtime-related code or templates; GitHub Actions local state is ephemeral |
| `docs/` | Repository-wide documentation |
| `.github/workflows/` | GitHub Actions workflows |
| `manifest.json` | Generated inventory of tracked files, directories, and descriptions |

Empty directories are retained by `.gitkeep` placeholders.

## Mandatory descriptive metadata

Every substantive Git-tracked file must have an entry in `config/file-metadata.json`, keyed by its repository-relative path. Each entry must include a nonempty `description` and may include a `category`.

Example:

```json
{
  "version": 1,
  "files": {
    "src/example.js": {
      "description": "Implements an example repository utility.",
      "category": "source"
    }
  }
}
```

Update metadata whenever adding, renaming, removing, or substantially changing a file. Descriptions are authored, not guessed from filenames. The manifest generator fails on missing or stale entries. `.gitkeep` placeholders and the generated `manifest.json` are exempt.

## Manifest generation

Run locally:

```sh
node src/generate-manifest.js
```

The [Update repository manifest](.github/workflows/update-manifest.yml) workflow runs on pushes to `main` (except manifest-only changes) and can be started manually. It validates the metadata registry, inventories tracked and new nonignored files, writes `manifest.json`, and commits changes only when the output differs. It requires GitHub Actions write permission to repository contents. If metadata is missing or stale, the workflow fails without publishing an incomplete manifest.

The manifest records the current file inventory, not a history of edits. Git remains the audit history. Generated files are not a substitute for workspace access enforcement: the eventual command executor must independently enforce allowed paths and promotion authorization.

## Working conventions

- Keep task-specific work inside a named workspace.
- Keep reusable tooling in `src/` and configuration in `config/`.
- Register each new substantive file in the metadata registry before committing.
- Do not treat workspace staging as permission to alter target files.
