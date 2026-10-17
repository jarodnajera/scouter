# Read-only npm preflight

The preflight inspects the project's intended manager and effective npm protections. It does not resolve packages, compare dependency graphs, contact registries or scanners, install anything, or approve a dependency. No dependency installation is needed to run it.

## Usage

From the repository's `hardhat-cli/` directory:

```powershell
node.exe src/cli.mjs inspect --project "C:\path\to\project" --format text
node.exe src/cli.mjs inspect --project "C:\path\to\project" --format json
```

The validated baseline is Node 24.22.0, npm 11.19.1, Windows x64, a single project root, and a v3 `package-lock.json`. macOS arm64/x64 use the same versions and require `--experimental-macos true`; actual Mac validation is pending. The selected runtime/npm installation must be outside the inspected project. Discovery checks adjacent Node layouts, Unix prefix layouts, and resolved npm symlinks on absolute PATH entries without invoking shell wrappers or downloading tools. An explicit installed entrypoint can be selected with `--npm-cli`; an invalid explicit path never falls back. See [Mac validation](macos-validation.md).

To inspect proposed command-line protection options, create a JSON file such as `npm-options.json`:

```json
["--min-release-age=7", "--ignore-scripts=true"]
```

```powershell
node.exe src/cli.mjs inspect --project "C:\path\to\project" --npm-options npm-options.json --format text
```

These options affect only the inspection. They are not persisted or applied to an installation. Only allowlisted `--key=value` protection options are accepted, with at most 64 bounded arguments. A future operation must use the reviewed options and unchanged configuration. `--at` is unavailable for live inspection; the collector uses the real clock.

`--operation` accepts `resolution` (default), `locked-install`, or `runner`. The last two always require manual checks because the qualified native cooldown does not establish release-age protection for existing locked packages, caches, or one-shot execution. These labels inspect assumptions; they never execute an operation.

## What is checked

- Manager declarations in `package.json`, lockfiles, and corroborating static command hints in root README/agent instructions and GitHub workflow files. Conflicting hints produce unsupported context; npm is never silently substituted for another manager. Text is read as data, not executed or followed as instructions.
- Exact installed Node/npm versions, npm entrypoint, platform, root layout, v3 lock structure, and root manifest/lock identity. Workspace projects and shrinkwrap are unsupported.
- Effective cooldown and absolute cutoff, their sources, exclusions, script suppression and bypass settings, lockfile use, TLS verification, and registry routes.
- npm `force` mode and OS/CPU/libc overrides, which invalidate the live workflow's native-platform assumptions and require review.
- Missing, invalid, unknown, ignored, or unreadable npm configuration; protection settings placed in selected other-manager configuration files; and changes to the root manifest, lockfile, or `.npmrc` during inspection.

Manager hints are deliberately conservative, not a complete parser for shell scripts or CI systems. Example commands can produce conflicts. A successful root identity check does not prove that the full manifest and dependency graph agree; use [graph comparison](graph-comparison.md) to check a supplied candidate graph.

The adapter uses the qualified installed npm's own `@npmcli/config` loader and definitions. This preserves npm's CLI, environment, project, user, global, builtin, and default precedence rather than approximating `.npmrc` parsing. For this npm version, `before` wins over `min-release-age` at the same source. It reports an overridden stronger cutoff even if the effective cutoff still meets Hardhat's seven-day minimum. Exemptions require review, and a cooldown alone cannot compensate for incomplete security evidence.

Version-matched references: [npm config API](https://github.com/npm/cli/blob/v11.19.1/workspaces/config/README.md) and [npm config definitions](https://github.com/npm/cli/blob/v11.19.1/workspaces/config/lib/definitions/definitions.js). Resolution behavior was separately qualified in [compatibility tests](compatibility.md).

## Report contract

The [preflight schema](../schemas/preflight.schema.json) defines `kind: preflight-report`, `mode: live-preflight`, and `authorization: none`. It is separate from the supplied-evidence inspection report.

| Status | Exit | Meaning |
| --- | --- | --- |
| `complete` | 0 | Supported context and no unresolved preflight concerns |
| `review` | 2 | Protection concerns or missing protection evidence |
| `unsupported` | 2 | Project, manager, registry, or toolchain context is outside qualified scope |
| Error report | 4 | Invalid input or internal failure |

None of these statuses is a package PASS or installation approval. `protectionMode: native` describes release-cutoff coverage for new resolution only; consult issues for script or other concerns. `manual-required` and `unknown` explicitly preserve missing native coverage.

Reports contain allowlisted settings and their sources, sanitized registry routing, effective cutoff, issues, toolchain identity, and input digests. The `checks` array contains supplied-evidence-compatible project `context` and `protections` records. It is not a complete evidence document for `review`: graph, binding, package identity, release, artifact behavior, and provider checks remain outstanding. Do not fill those gaps with fabricated success records.

## Trust, privacy, and limits

The installed Node/npm code is a trusted prerequisite, not independently authenticated. The helper loads config APIs from that installation without running the npm CLI, project code, lifecycle hooks, or executable project configuration. No configuration save or repair API is called.

The helper runs without a shell, with a restricted startup environment, a ten-second timeout, a 128 MiB V8 heap limit, and bounded input/output. Supplied environment variables are passed as data for native npm configuration interpolation; they cannot become helper startup options such as `NODE_OPTIONS`. These measures are not an OS sandbox or a total process-memory limit. npm's own config reads remain subject to its implementation.

Root JSON/config reads are bounded to 4 MiB; static hint files to 256 KiB and workflow enumeration to 50 entries. Unsupported file shapes or oversized inputs fail rather than producing a successful inspection.

Raw npm diagnostics and full configuration dumps are never forwarded. Credential values, private registry URLs, scoped registry names, and exclusion values are withheld. Reports can still contain local project/toolchain paths and project input digests; review those before sharing. Only an exact clean public npm registry route is qualified; private/custom routes never trigger fallback queries.

The relevant-config digest hashes a redacted summary, not the full configuration or environment. It cannot serve as an enforcement binding. Root manifest, lockfile, and `.npmrc` are reread to detect changes, but this is not an atomic snapshot of all user/global configuration or the filesystem. Reinspect immediately before use; this report does not authenticate or authorize an installation.

## Validation

Run the maintained suite on the supported Windows baseline with:

```powershell
node scripts/test.mjs
```

Preflight tests exercise the installed native config parser with local synthetic fixtures. They cover precedence, stronger-control preservation, exclusions, invalid/ignored configuration, manager conflicts, unsupported contexts, secret redaction, script suppression, startup-option isolation, CLI exit codes, schema parity, and unchanged project/config snapshots. They do not contact registries or install packages. Fixtures are retained in temporary directories for inspection.
