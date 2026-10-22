# GitHub Actions runtime limits — CommandLine

**Verified against GitHub documentation:** October 22, 2026  
**Applies to:** `.github/workflows/run-js.yml` using `runs-on: ubuntu-latest` and job container `node:22-alpine`.

This reference distinguishes **GitHub platform limits**, **machine capacity**, and **our own configurable defaults**. A missing executor timeout does not remove GitHub's platform limits.

## 1. Duration and execution

| Restriction | GitHub value | Configurable inside our container? |
| --- | --- | --- |
| Maximum GitHub-hosted job runtime | **6 hours** | **No**; job `timeout-minutes` cannot extend this |
| Maximum workflow-run lifetime (including waiting) | **35 days** | No |
| Environment approval wait | **30 days** | No |
| Maximum matrix jobs | **256 per workflow** | No |
| Maximum re-runs | **50 per workflow run** | No |
| Maximum workflow YAML file size | **500 KB** | No |
| Workflow event triggering rate | **1,500 events / 10 seconds / repository** | No |
| Workflow runs queued | **500 runs / 10 seconds** | No |
| Self-hosted job duration | **5 days** | Not applicable to current GitHub-hosted runner |

The workflow currently defaults `job_timeout_minutes` to **360**; that is the full GitHub-hosted job ceiling. Internal script and dependency-install timeouts default to **null** (no additional executor timeout).

Source: [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits).

## 2. Actual machine resources

These are **standard `ubuntu-latest` VM specifications**. The Docker job container shares the VM's resources; do not interpret these values as a separately guaranteed container quota.

| Repository visibility | CPU | Memory | SSD | Architecture |
| --- | ---: | ---: | ---: | --- |
| Public | **4 vCPU** | **16 GB** | **14 GB** | x64 |
| Private | **2 vCPU** | **8 GB** | **14 GB** | x64 |

Usable filesystem space may be lower after OS image, tools, container layers, and checkout. The current repository's visibility and measured in-container free capacity were not verified.

Source: [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## 3. Workflow inputs and transmitted data

| Constraint | Maximum |
| --- | --- |
| Top-level `workflow_dispatch.inputs` properties | **25** |
| Manual dispatch input payload | **65,535 characters** |
| Single workflow YAML file | **500 KB** |
| Structured job outputs | **1 MB per job**, approximately UTF-16 |
| Total structured job outputs | **50 MB per workflow run** |

**Important for this repository:** `source` is currently sent as a workflow input. Therefore, very large JavaScript programs may hit the **65,535-character manual dispatch input payload limit** before the container starts. Using a checked-out source file or an artifact would require an interface change.

The **1 MB job-output limit is not the same as a 1 MB stdout/log limit**. Logs have GitHub-managed handling and retention; unlimited log output is not guaranteed.

Sources: [Workflow dispatch](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).

## 4. Concurrency and queued work

Maximum concurrent **standard hosted** jobs varies with account plan:

| Plan | Concurrent jobs |
| --- | ---: |
| Free | 20 |
| Pro | 40 |
| Team | 60 |
| Enterprise | 500 |

These are GitHub plan ceilings, not an individual-container concurrency setting. Certain limits can be increased through GitHub Support. The repository's actual entitlement was not verified.

Source: [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits).

## 5. Log and artifact retention

| Policy | Specific value |
| --- | --- |
| Default retention | **90 days** |
| Configurable retention, public repositories | **1–90 days** |
| Configurable retention, private repositories | **1–400 days** |
| Organization/enterprise override | May further restrict retention |
| Local container files | Temporary; not automatically retained after job finishes |

Beginning **October 1, 2026**, the configured retention policy also applies to checks, workflow runs, and commit statuses in addition to artifacts and logs.

Source: [GitHub retention settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

## 6. Our settings, not GitHub-imposed limits

| Setting | Present default | Configured in |
| --- | --- | --- |
| Script timeout | `null` (no executor cap) | `config/js-executor.json` |
| Dependency installation timeout | `null` (no executor cap) | `config/js-executor.json` |
| Streamed-output limit | `null` (no executor cap) | `config/js-executor.json` |
| Dependencies | `[]` | `config/js-executor.json` |
| JSON arguments | `{}` | `config/js-executor.json` |
| JavaScript environment variables | `{}` | `config/js-executor.json` |
| Job duration requested | `360` minutes | `run-js.yml` |
| Execution OS/image | `ubuntu-latest` / `node:22-alpine` | `run-js.yml` |

Environment variables may override executor configuration. GitHub Actions job limits and machine specifications cannot be overridden by setting `null` in our JSON configuration.

## 7. Other constraints worth distinguishing

- **Authentication:** The workflow's `permissions: {}` does not grant repository write scopes to submitted JavaScript. Actual token availability and expiration depend on how credentials are provided.
- **Network and registry:** npm downloads, network access, external API rates, and repository API quotas have their own limits; there is no single universal allowance for all endpoints.
- **Execution isolation:** The job container is not an absolute security sandbox. Code can access resources and network connections available within that container.
- **Persistence:** Checkout files, runtime installations, and temporary outputs vanish after the job unless committed or explicitly exported. The workflow currently does not publish result artifacts.
- **Container image:** GitHub Actions presently starts the stock `node:22-alpine` image. It does **not** build `runtime/Dockerfile`.
- **Verification still needed:** Run a GitHub Actions test job to confirm container initialization, available free disk and memory, actual input behavior, and result handling.

## Documentation sources

1. https://docs.github.com/en/actions/reference/limits
2. https://docs.github.com/en/actions/reference/runners/github-hosted-runners
3. https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
4. https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
5. https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
