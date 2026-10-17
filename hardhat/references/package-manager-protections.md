# Package-manager protection preflight

Read before resolving, installing, upgrading, or executing third-party packages. These examples map Hardhat's default seven-day cooldown to native controls; use the project's explicit policy instead when present. Documentation checked on 2026-10-16. Verify syntax and behavior against the installed version before use.

For actionable Yarn Classic, modern Yarn, and pnpm workflows, read [Yarn and pnpm guarded installs](yarn-pnpm.md). The Yarn age setting below is not available in Classic; older manager versions may require the manual fallback described here.

For pip, read [pip guarded installs](pip.md) before resolution or installation, including requirements-file preflight and source-build restrictions.

## Detect and verify

1. Identify the intended manager for the relevant workspace from project instructions, manifest declarations such as `packageManager`, lockfiles, and CI commands. Multiple ecosystems may need separate checks. Resolve conflicting evidence before changing dependencies; do not select npm merely because it is installed.
2. Verify the actual executable/version using a trusted installation. Some shims automatically download the requested toolchain; review that bootstrap before permitting it. Do not run untrusted project plugins just to inspect configuration.
3. Inspect only relevant configuration keys and environment overrides; avoid dumping config files or environments containing registry tokens. Confirm the setting is in the location that this manager/version reads, with correct units and type.
4. Verify the effective setting using supported read-only config inspection and version-matched documentation. Check CLI/environment precedence, exclusions, relaxed modes, explicit cutoffs, and the working directory. An unrecognized setting or a warning is not evidence of enforcement.
5. Check coverage for the actual subcommand: new resolution, frozen install, exact pins, existing lockfiles, caches, private registries, and one-shot runners may behave differently. Supplement gaps with exact-artifact review. Do not install a suspicious package to test whether protection works.

## Release-age controls

| Manager | Seven-day example | Location / units | Official documentation |
| --- | --- | --- | --- |
| npm | `--min-release-age=7` or `min-release-age=7` | Command flag or project `.npmrc`; days | [npm install](https://docs.npmjs.com/cli/v12/commands/npm-install/#min-release-age) |
| pnpm | `minimumReleaseAge: 10080` | `pnpm-workspace.yaml`; minutes | [Dependency resolution settings](https://pnpm.io/settings/dependency-resolution#minimumreleaseage) |
| Yarn (versions supporting the setting) | `npmMinimalAgeGate: "7d"` | `.yarnrc.yml`; duration string | [Yarn settings](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate) |
| Bun | `--minimum-release-age 604800` or `minimumReleaseAge = 604800` | Command flag or `[install]` in `bunfig.toml`; numeric values are seconds | [Bun install](https://bun.sh/docs/pm/cli/install#minimum-release-age) |
| pip (versions supporting the option) | `--uploaded-prior-to P7D` | Command flag; ISO 8601 duration or timestamp; requires index upload-time metadata | [pip install](https://pip.pypa.io/en/stable/cli/pip_install/#cmdoption-uploaded-prior-to) |
| uv | `--exclude-newer "7 days"` or `exclude-newer = "7 days"` | Command flag, `[tool.uv]` in `pyproject.toml`, or top-level `uv.toml`; duration on supporting versions | [uv resolution](https://docs.astral.sh/uv/concepts/resolution/), [settings](https://docs.astral.sh/uv/reference/settings/#exclude-newer) |

For uv versions supporting an absolute cutoff but not durations, compute a UTC RFC 3339 timestamp seven days before the review and use that supported form. Record the evaluated cutoff. A committed fixed timestamp freezes the eligibility horizon; it is not a rolling seven-day policy. An existing uv lockfile does not automatically re-resolve as time passes.

Do not copy these settings into other managers' configuration files or invent equivalent flags for unlisted managers. Verify their current official documentation and report unsupported capabilities explicitly.

## Coverage and exceptions

- npm's `before` can override the relative window, and higher-precedence settings can override project configuration. Inspect `min-release-age-exclude`. Do not assume a command's setting is exported to child processes.
- pnpm's age setting was introduced in 10.16.0. Verify the installed version's defaults, strictness, exclusions, and exceptions, including config dependencies; do not assume all versions behave alike.
- Inspect Yarn's `npmPreapprovedPackages`; these patterns exempt matching packages from package gates.
- Bun's age filter applies to new resolution, leaving existing lockfile entries unchanged. Its documented behavior permits versions with missing publish timestamps; Hardhat must treat missing timestamps as unknown regardless of native acceptance.
- Inspect uv's per-package cutoff overrides and whether the operation actually performs resolution.
- For pip, verify `--uploaded-prior-to` in the installed version and index metadata coverage. Record a UTC cutoff and preserve stronger policy. Check exact selected artifacts, including later-uploaded wheels and transitives; missing timestamps or unsupported filtering require the manual fallback. Do not copy uv's `--exclude-newer` flag to pip.

An exclusion's existence does not establish that it is authorized for this request. Honor explicit project policy and existing scoped user exceptions, but flag unexplained broad bypasses. Never create a blanket exclusion to resolve a cooldown failure. Reassess a security-fix release rather than retaining a vulnerable version solely to meet the age threshold.

Also verify the manager's supported controls for unreviewed install/build scripts, registry origin and integrity, and frozen/immutable installation of the reviewed lockfile. Scope script exceptions to the required packages and behavior. Release-age filtering does not replace these checks or the advisory and dependency-delta review in SKILL.md.

If native age enforcement is unavailable, independently verify the exact resolved artifacts against policy and preserve that graph. Report this as manual fallback, not native protection. An incomplete graph, missing timestamps, or uncertain command behavior requires REVIEW before installation.

## Report briefly

Example format, using actual observed values:

`Manager: npm <observed version>; cooldown: 7 days via --min-release-age=7; exceptions: none; coverage: new resolution; locked artifacts checked separately; scripts: <verified control>.`

For unsupported tooling, state the missing feature, manual checks completed, remaining gap, and decision. Reuse verified findings during the task unless the executable, configuration, command scope, or policy changes.
