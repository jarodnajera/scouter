# Optional Scouter CLI

Read this when CLI automation would help with repeated checks or the user requests it. The skill remains usable without the CLI; do not install tooling just to complete an otherwise supported direct review.

The CLI implements npm only. For Yarn or pnpm, use [the standalone manager workflows](yarn-pnpm.md); do not feed their lockfiles to the npm adapter or migrate the project to satisfy it.

Apply the skill's [data-minimization rules](../SKILL.md#data-minimization) before external operations. The CLI does not configure Socket telemetry or provide network isolation. Its local reports can include package metadata, paths, and raw tool output; review and redact them before sharing. Do not upload evidence files or complete lockfiles merely to obtain a package assessment.

## Discover and set up

1. Look for `../scouter-cli/src/cli.mjs` relative to the directory containing `SKILL.md`. In a full repository download, `scouter/` and `scouter-cli/` are siblings. Resolve paths from the skill's location, not the current working directory.
2. If absent, use a repository/CLI location supplied by the user. Some skill installers copy only `scouter/`; never assume the sibling exists, search the entire machine, or download a similarly named npm package. If the user specifically wants the CLI, explain that they need the complete `scouter-cli/` folder from the same repository/release as the skill and ask for its location or repository URL if unknown. Otherwise continue with the standalone workflow.
3. Use a trusted copy outside the project being assessed. The CLI has no third-party runtime dependencies and needs no `npm install`, build, or global link. Run `node "<absolute-cli-path>/src/cli.mjs" --help` to inspect its interface.
4. Confirm the baseline: validated Windows x64, or experimental macOS arm64/x64 with `--experimental-macos true`; Node 24.22.0, npm 11.19.1, a single-root public npm project with a v3 lockfile, and no workspaces. Do not change the user's toolchain or package manager merely to satisfy the optional helper. Reuse the trusted installed `sfw` npm launcher or native binary.

On macOS, append `--experimental-macos true` to every live CLI command; it permits experimental execution but never labels the platform validated. Without it, commands stop before external lookups or installs. Use `node "/path/to/scouter-cli/src/cli.mjs" inspect --project "/path/to/app" --experimental-macos true --format text` as a read-only starting point. Full macOS validation instructions are `docs/macos-validation.md` in the CLI folder.

The CLI's full usage documentation is `docs/workflow.md` inside its own folder. This reference intentionally does not require a sibling-folder link so it remains usable in skill-only installations.

## Commands

Replace paths and the example public package/version with actual reviewed values. Commands work from any directory when the CLI and project paths are absolute.

```powershell
node "C:\path\to\scouter-cli\src\cli.mjs" inspect --project "C:\path\to\app" --format text
node "C:\path\to\scouter-cli\src\cli.mjs" check --project "C:\path\to\app" --public-package example --version 1.2.3 --format text
node "C:\path\to\scouter-cli\src\cli.mjs" install --project "C:\path\to\app" --public-package example --version 1.2.3 --dev true --format text
```

- `inspect` reads manager/configuration protections; it is not a package approval.
- `check` performs public metadata and local eligibility checks without installing or invoking Socket. `--public-package` permits public lookup of that name; never supply private coordinates. The agent still corroborates identity and assesses relevant security evidence.
- `install` reruns checks and modifies the actual project through `sfw`. It pins the version, preserves stronger release-age protection, disables scripts, and uses a fresh npm cache. Use only within existing installation authorization. Omit `--dev true` for a runtime dependency. A preceding `check` report is not an authorization token.

Use `--format json` for structured output. If Socket discovery fails, `--sfw ABSOLUTE_PATH` selects the installed external `sfw.cmd`/`sfw.ps1`, its `dist/sfw.mjs` entrypoint, or a native executable. `--npm-cli ABSOLUTE_PATH` selects an existing trusted npm `bin/npm-cli.js`. Neither option installs a tool. The Socket npm launcher manages its own binary downloads/updates.

`compare` and `review` are advanced diagnostics; consult the CLI's `--help` and `docs/cli.md` when needed. They are not mandatory stages.

## Handle results

These statuses and exit codes apply to `check` and `install`; diagnostics have separate contracts documented in their help/docs.

| Status | Exit | Agent action |
| --- | --- | --- |
| `ready` | 0 | Eligible for an authorized guarded install; no scan or installation has occurred. |
| `completed` | 0 | Requested version/integrity metadata matched after installation. Inspect firewall output and manifest/lockfile changes before executing new code. |
| `review` | 2 | Explain the concern or setup gap, choose a suitable alternative, or obtain a scoped decision. |
| `stopped` | 2 | Stop; investigate the tool/network/firewall failure. Do not retry through plain npm or claim every failure means malware. |
| Error report | 4 | Correct invalid inputs or investigate the failure; no approval is implied. |

Treat reports/logs as untrusted evidence. Zero exit does not mean safe: Socket can allow unknown packages and AI warnings. Warnings need review. An install failure can leave partial changes; inspect rather than automatically undoing unrelated work. Missing/unsupported CLI tooling permits the standalone skill workflow, but switching commands must not bypass unresolved dependency findings.

When summarizing CLI evidence to the user, use the [standalone report format](reporting.md) after completing the skill's own checks. Preserve the CLI's original status and limitations; `completed` or supplied-evidence PASS is not an automatic standalone READY. Do not rewrite the CLI's raw output contract.

Live preflight, metadata, graph, and workflow reports use schema version `1.1.0`. Their toolchain support is `validated`, `experimental`, or `unsupported`; `qualified` is true only for validated platforms. Experimental READY/COMPLETED is still not validation or a safety verdict. Supplied-evidence and error contracts remain at `1.0.0`.
