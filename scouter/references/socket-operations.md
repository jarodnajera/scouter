# Socket operations and data handling

Complete the assessment in [guard acquisition](../SKILL.md#guard-acquisition) before first Socket use in a task. Read this guide for setup, uncertain coverage or data handling, cache adoption, or restricted policy. Reuse the assessment only while tooling, configuration, policy and operation scope remain compatible. Apply the [core trust rules](../SKILL.md#trust-and-report) and applicable manager guide.

## Setup and cache

Reuse the user's trusted npm-installed launcher (`sfw`, or `sfw.cmd` on Windows) or native binary. If missing, explain the one-time setup in [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free#installation), which document `npm i -g sfw`; pause dependency acquisition until compatible tooling is available. Setup is separate from the candidate installation. The npm launcher manages native binary downloads/updates; assess that behavior before invoking it.

Free supports public registries. Verify the actual manager operation and source, rather than assuming ecosystem support covers every command. Unsupported coverage stops guarded acquisition; approval cannot manufacture support.

Socket recommends clearing the manager cache when adopting it (npm: `npm cache clean --force`). Explain that clearing removes cached artifacts and requires downloads again; do not silently purge shared caches. Prefer the applicable guide's compatible fresh task-owned cache or no-cache option. Cached artifacts can bypass download checks. Neither approach rescans existing `node_modules`, installed Python packages or other previously installed bytes.

## Scope and data handling

Use `sfw` around supported dependency-management operations, not arbitrary application commands. Managers still make normal registry requests. Check routing and authentication before proceeding; never expose credentials in reports. Minimize inherited credentials where compatible, but do not silently strip required authentication or claim this confines subprocesses.

Apply [data minimization](../SKILL.md#data-minimization): extract necessary public coordinates locally. Public-package lookup permission does not authorize source, manifest/lockfile or repository uploads, private-coordinate disclosure, or an additional audit service.

Socket's [documented Free telemetry](https://docs.socket.dev/docs/socket-firewall-free#telemetry) includes package coordinates, a machine identifier, timing/errors and potentially a GitHub organization name. Socket states it does not collect source code, repository names or commit history. Free telemetry cannot be disabled or configured. These are vendor statements, not independently verified network behavior; reassess relevant tool/documentation changes.

If policy prohibits those fields or requires strictly package-only egress, do not run Socket Free. Explain the incompatibility and request an approved compatible tool/configuration. Do not invent an opt-out, remove Git metadata or assume a temporary directory satisfies policy. Unknown sharing behavior requiring assurance remains REVIEW; it does not authorize additional uploads.

## Output and limits

Inspect warnings and partial changes even after exit zero. Free may warn without blocking suspected threats and allows unknown/unscanned versions. A banner or successful exit proves neither complete scanning nor safety. Stop failures without an unwrapped retry. Socket is not an application sandbox; retain the core's approval and BLOCK boundaries.

Documentation checked 2026-10-19 against the linked Socket Free guide for setup, cache, coverage and telemetry; not a new traffic audit or live test.
