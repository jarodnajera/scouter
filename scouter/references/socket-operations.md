# Socket operations and data handling

Complete this assessment before first Socket use in a task, or use the equivalent assessment in [routine review](routine-review.md) when eligible. Read this full guide for setup, uncertainty, restricted policy, or other escalation. Reuse only while tooling, configuration, policy, and operation scope remain compatible. Apply the [core trust rules](../SKILL.md#data-minimization) and [manager protections](package-manager-protections.md).

## Setup and cache

Reuse the user's trusted npm-installed launcher (`sfw`, or `sfw.cmd` on Windows) or native binary. If Socket is missing, explain the one-time setup from [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free), which document `npm i -g sfw`; pause the dependency installation until the tool is available. The npm launcher manages its own Socket binary downloads/updates. Free collects telemetry and supports public registries; if the manager or registry is unsupported, report the limitation rather than claim guarded installation.

Socket recommends clearing the package-manager cache when adopting it (npm: `npm cache clean --force`) and using `sfw` for subsequent downloads. Explain that clearing removes cached artifacts and requires downloads again; do not silently clear shared caches on every install. Alternatively, use a fresh task-owned cache with the manager's supported option. Cached artifacts can bypass download checks, and neither approach rescans existing `node_modules` or equivalent installed packages.

## Scope and data handling

Apply the [core data-minimization rules](../SKILL.md#data-minimization) to local inspection, external requests and reports. Extract public coordinates locally; public-package lookup permission does not authorize repository upload or an additional audit service.

Use `sfw` around supported dependency-management operations, not arbitrary application commands. Package managers still make their normal registry requests; check private registry routing and authentication requirements before proceeding. Minimize inherited credentials where compatible with the task, but do not strip required authentication silently or claim this confines subprocesses.

Socket's [documented Free telemetry](https://docs.socket.dev/docs/socket-firewall-free#telemetry) includes package coordinates, a machine identifier, timing/errors, and potentially a GitHub organization name; Socket states it does not collect source code, repository names, or commit history. Free telemetry cannot be configured or disabled. This is vendor documentation, not independently verified network behavior. This skill does not enforce a package-only telemetry sandbox.

If user/project policy prohibits those additional fields or requires strictly package-only egress, do not run Socket Free. Explain the incompatibility and request an approved tool/configuration; do not invent an opt-out flag, remove Git metadata, or assume running in a temporary folder satisfies the policy. Unknown data-sharing behavior requiring assurance is a REVIEW concern, not permission to upload more data.

