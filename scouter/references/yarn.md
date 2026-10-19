# Yarn

Read the core and only the installed major's section. Inspect `yarnPath`, plugins and hooks before invoking them; `yarn.lock` alone does not identify the version.

## Classic

| Field | Yarn 1.x |
| --- | --- |
| Detect | Trusted version 1.x, `.yarnrc`, project `packageManager`. |
| Guarded acquisition | `sfw yarn add <name>@<exact> --exact --ignore-scripts --cache-folder <fresh-cache>`; add `--dev` where intended. |
| Native cooldown | No modern age gate. Transitive age coverage is Unsure; ask for informed acceptance rather than researching every artifact. Direct release age still needs review. |
| Script/build suppression | `--ignore-scripts`; no modern build settings. A necessary package-local build must have reviewed hooks, binary resolution and environment; no suitable bounded invocation means stop. |
| Cache | Fresh task cache plus offline-mirror inspection. Do not purge shared mirrors automatically. |
| Frozen graph | For a supplied reviewed graph: `sfw yarn install --frozen-lockfile --ignore-scripts --cache-folder <fresh-cache>`. |
| Gotchas | Do not migrate to modern Yarn/npm. If no safe proposal path exists, disclose unavailable preinstall graph/advisory evidence and obtain approval before acquisition; complete the bulk lookup afterward, before code execution. |

## Modern

| Field | Yarn 2+ |
| --- | --- |
| Detect | Trusted version, `.yarnrc.yml`, `packageManager`. |
| Guarded acquisition | `sfw yarn add <name>@<exact> --exact --mode=skip-build`; `--dev` where intended. A supported `--mode=update-lockfile` can prepare a proposal; then inspect and install the reviewed graph. |
| Native cooldown | On supporting versions, `npmMinimalAgeGate: "7d"`; verify preapprovals, exclusions and lock coverage. Gaps mean Unsure. |
| Script/build suppression | Verify `skip-build` spelling. `enableScripts: false` has exceptions; review workspace and per-package settings. Use inspected per-package build permissions and targeted `sfw yarn rebuild <name>` only after reviewing all matching versions/instances. |
| Cache | Verify `enableGlobalCache`, `cacheFolder` and `enableMirror`; a fresh local cache alone may reuse a global mirror. Preserve committed zero-install archives. |
| Frozen graph | `sfw yarn install --immutable --mode=skip-build` with matching cache/age settings. |
| Gotchas | Never use a blanket time-gate bypass. For an approved fresh exact pin, a temporary exact descriptor in `npmPreapprovedPackages` can bypass multiple gates; verify its full effect and preserve stronger policies or stop. |

Documentation checked 2026-10-19: [Classic install](https://classic.yarnpkg.com/en/docs/cli/install/), [modern add](https://yarnpkg.com/cli/add), [settings](https://yarnpkg.com/configuration/yarnrc), [rebuild](https://yarnpkg.com/cli/rebuild). Documentation only, not modern-Yarn live validation.
