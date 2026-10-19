# Package-manager protection preflight

Read before resolving, installing, upgrading, or executing third-party packages outside the [routine route](routine-review.md). Eligible routine reviews use that shared preflight and only their manager instructions; npm reads the section below. These examples map Scouter's default seven-day cooldown to native controls; use the project's explicit policy instead when present. Documentation checked on 2026-10-16. Verify syntax and behavior against the installed version before use.

## Routine npm

Use with the core and [routine review](routine-review.md); no other section is required unless capabilities or eligibility are uncertain. Preserve project configuration, dependency category, registry/TLS and exact pins. Verify `ignore-scripts` and effective `audit=false`, or explicitly pass `--audit=false` on acquisition unless that disclosure was separately approved. Inspect age exclusions and `before` precedence; verify cutoff syntax, units and coverage for the installed version rather than assuming newer flags work. Use native age enforcement within verified coverage; manually check uncovered locked/excluded artifacts and retain the reviewed graph.

Prepare a supported guarded lock-only proposal with scripts suppressed before installing changed dependencies. Inspect its manifest/lock changes and complete graph/artifact checks first. If a proposal already exists, verify its consistency and provenance rather than resolving it again. No safe proposal path means REVIEW.

Acquire through `sfw` with script/audit suppression and a compatible empty task-owned npm cache. A matching reviewed manifest/lock can use `npm ci --ignore-scripts --audit=false --cache <fresh-task-cache>` only when replacing `node_modules` is authorized. Otherwise review a graph-preserving alternative; do not force replacement. Do not put frozen-install flags on additions. Verify resulting versions/origins/integrity and stop before code execution on drift, warnings or failures. `npm install` alone is not proof of a frozen graph. [npm CI](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## Detect and verify

Identify the manager/workspace from project instructions, declarations, lockfiles and CI. Resolve conflicting evidence before proceeding; do not switch managers. Inspect only relevant configuration and environment overrides without dumping credentials. Establish the trusted executable, installed version, effective settings and actual operation using the procedure below.

For npm acquisition, retain effective `audit=false` or explicit `--audit=false` unless that additional disclosure was approved. Public-coordinate lookup permission does not authorize audit uploads.

## Resolve version discrepancies

Reference examples are not proof of installed-version support:

1. Identify the trusted executable, version and subcommand. Inspect project executables, hooks/plugins and auto-downloading shims before invoking help; inspection must not execute unreviewed code or bootstrap tooling.
2. Prefer installed subcommand help over conflicting examples. For missing settings, consult matching official configuration documentation or versioned source: help can omit configuration-only options. Record discrepancies and sources.
3. Verify effective configuration location, types, units, precedence, exclusions and relaxed modes. Establish operation-specific coverage of resolution, existing locks, exact pins, caches, registries and child processes. Recognized flags or printed settings alone do not prove enforcement; ignored settings or unresolved conflicts remain gaps.
4. Use an established equivalent or exact-artifact manual fallback only with complete evidence and graph preservation. Otherwise return REVIEW. Never invent flags, remove stronger protections, upgrade/switch tooling or perform trial installs to make examples work.

Retain versions, sources, coverage and gaps in the report. Reuse verification only while executable/version, configuration, policy and operation remain compatible. Documentation-review dates do not establish live platform compatibility; see the README's maintenance policy.

## Release-age controls

Use verified native controls as evidence for the requirement they enforce, without repeating the same check manually. Record the installed version, effective configuration, cutoff and covered artifacts/operation. Apply manual review only to uncovered artifacts or unresolved enforcement; a flag or successful exit alone is insufficient. Native age filtering does not replace identity, static behavior, graph/integrity or advisory checks. Python coverage must apply to the selected wheel, including later uploads, not merely a version’s first release date. Preserve selected-wheel/hash binding and record native cutoff evidence or the manually checked upload date.

| Manager | Seven-day example | Location / units | Official documentation |
| --- | --- | --- | --- |
| npm | `--min-release-age=7` or `min-release-age=7` | Command flag or project `.npmrc`; days | [npm install](https://docs.npmjs.com/cli/v12/commands/npm-install/#min-release-age) |
| pnpm | `minimumReleaseAge: 10080` | `pnpm-workspace.yaml`; minutes | [Dependency resolution settings](https://pnpm.io/settings/dependency-resolution#minimumreleaseage) |
| Yarn (versions supporting the setting) | `npmMinimalAgeGate: "7d"` | `.yarnrc.yml`; duration string | [Yarn settings](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate) |
| pip (versions supporting the option) | `--uploaded-prior-to P7D` | Command flag; ISO 8601 duration or timestamp; requires index upload-time metadata | [pip install](https://pip.pypa.io/en/stable/cli/pip_install/#cmdoption-uploaded-prior-to) |
| uv | `--exclude-newer "7 days"` or `exclude-newer = "7 days"` | Command flag, `[tool.uv]` in `pyproject.toml`, or top-level `uv.toml`; duration on supporting versions | [uv resolution](https://docs.astral.sh/uv/concepts/resolution/), [settings](https://docs.astral.sh/uv/reference/settings/#exclude-newer) |

For uv versions supporting an absolute cutoff but not durations, compute a UTC RFC 3339 timestamp seven days before the review and use that supported form. Record the evaluated cutoff. A committed fixed timestamp freezes the eligibility horizon; it is not a rolling seven-day policy. An existing uv lockfile does not automatically re-resolve as time passes.

Do not copy these settings into other managers' configuration files or invent equivalent flags for unlisted managers. Verify their current official documentation and report unsupported capabilities explicitly.

Scoped documentation review, 2026-10-19: rechecked native-age and script-control guidance against official npm 12.2.0, pip 26.2.1, pnpm settings (including v11 strictness), current Yarn/Classic and uv documentation, plus Socket download/cache limits. No installed-manager execution or platform qualification was performed. Other documentation-check dates retain their original scope.

## Coverage and exceptions

- npm's `before` can override the relative window, and higher-precedence settings can override project configuration. Inspect `min-release-age-exclude`. Do not assume a command's setting is exported to child processes.
- pnpm's age setting was introduced in 10.16.0. Verify the installed version's defaults, strictness, exclusions, and exceptions, including config dependencies; do not assume all versions behave alike.
- Inspect Yarn's `npmPreapprovedPackages`; these patterns exempt matching packages from package gates.
- Inspect uv's per-package cutoff overrides and whether the operation actually performs resolution.
- For pip, verify `--uploaded-prior-to` in the installed version and index metadata coverage. Record a UTC cutoff and preserve stronger policy. Check exact selected artifacts, including later-uploaded wheels and transitives; missing timestamps or unsupported filtering require the manual fallback. Do not copy uv's `--exclude-newer` flag to pip.

An exclusion's existence does not establish cooldown compliance. Preserve stronger project policy and flag bypasses. Scouter must not create cooldown exclusions, lower age controls, or reuse retired security-fix approvals to admit fresh artifacts. Manually check excluded artifacts against the original cutoff; unresolved age gaps remain REVIEW. For installed-vulnerability remediation, explain the [installation scope](../SKILL.md#installation-scope) and hand off to a separately scoped review. Confirmed blocking evidence remains BLOCK.

Apply the selected manager's script/build, registry, integrity, cache and graph-preservation protections. Missing native coverage requires exact-artifact evidence bound to the preserved graph; incomplete coverage remains REVIEW. Age filtering never replaces the other core checks. Necessary builds require [build-script review](build-scripts.md); Python builds remain a separate boundary.
