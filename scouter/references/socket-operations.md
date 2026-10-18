# Socket operations and data handling

Complete this assessment before first Socket use in a task, or use the equivalent assessment in [routine review](routine-review.md) when eligible. Read this full guide for setup, uncertainty, restricted policy, or other escalation. Reuse only while tooling, configuration, policy, and operation scope remain compatible. Apply the [core trust rules](../SKILL.md#data-minimization) and [manager protections](package-manager-protections.md).

## Setup and cache

Reuse the user's trusted npm-installed launcher (`sfw`, or `sfw.cmd` on Windows) or native binary. No Scouter CLI installation is required. If Socket is missing, explain the one-time setup from [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free), which document `npm i -g sfw`; pause the dependency installation until the tool is available. The npm launcher manages its own Socket binary downloads/updates. Free collects telemetry and supports public registries; if the manager or registry is unsupported, report the limitation rather than claim guarded installation.

Socket recommends clearing the package-manager cache when adopting it (npm: `npm cache clean --force`) and using `sfw` for subsequent downloads. Explain that clearing removes cached artifacts and requires downloads again; do not silently clear shared caches on every install. Alternatively, use a fresh task-owned cache with the manager's supported option. Cached artifacts can bypass download checks, and neither approach rescans existing `node_modules` or equivalent installed packages.


## Scope and data handling

Keep this dependency review focused on packages. Read only the local manifests, lockfiles, relevant manager configuration, and targeted changes needed for the checks. Do not recursively scan the application's source, customer data, or unrelated files for this workflow. This does not prevent reading source needed for the user's separately authorized coding task.

For external searches and advisory queries, send only necessary public package names, versions, and public advisory identifiers. Do not upload project source, repository archives, entire manifests/lockfiles, `.env` files, credentials, private package coordinates, customer records, or other PII to scanners, search engines, or support channels as part of Scouter. Extract relevant public dependency coordinates locally instead. Redact sensitive values from reports/logs before sharing; do not dump full configuration or environments. Public-package lookup authorization does not authorize repository upload. Do not enable an additional audit/upload service implicitly.

Use `sfw` around supported dependency-management operations, not arbitrary application commands. Package managers still make their normal registry requests; check private registry routing and authentication requirements before proceeding. Minimize inherited credentials where compatible with the task, but do not strip required authentication silently or claim this confines subprocesses.

Socket's [documented Free telemetry](https://docs.socket.dev/docs/socket-firewall-free#telemetry) includes package coordinates, a machine identifier, timing/errors, and potentially a GitHub organization name; Socket states it does not collect source code, repository names, or commit history. Free telemetry cannot be configured or disabled. This is vendor documentation, not independently verified network behavior. Neither this skill nor the optional CLI enforces a package-only telemetry sandbox.

If user/project policy prohibits those additional fields or requires strictly package-only egress, do not run Socket Free. Explain the incompatibility and request an approved tool/configuration; do not invent an opt-out flag, remove Git metadata, or assume running in a temporary folder satisfies the policy. Unknown data-sharing behavior requiring assurance is a REVIEW concern, not permission to upload more data.

