# Candidate graph comparison

Scouter compares an externally prepared candidate manifest/lockfile with the current project, snapshots sanitized inputs, and optionally checks every candidate artifact's release metadata. It does **not** generate a candidate lockfile or authorize installation.

## Why automatic resolution remains unavailable

The selected Node 24.22.0 runtime exposes filesystem/subprocess permission controls, but no network permission switch that establishes the required resolver boundary. A temporary directory, `--ignore-scripts`, and a registry URL alone do not prove filesystem/process/network confinement.

The compare command does not invoke npm install to generate a candidate lockfile. There is no flag to bypass this restriction. `compare --project DIR` without candidate files returns REVIEW with `RESOLUTION_ISOLATION_UNAVAILABLE` and `SUPPLIED_PROPOSAL_REQUIRED`.

A separate synthetic test qualifies the narrow npm lockfile-only behavior, described below. It does not enable the production resolver.

## Run

From the repository's `scouter-cli/` directory, with an existing proposal:

```powershell
node.exe src/cli.mjs compare --project "C:\path\to\project" --candidate-manifest "C:\proposal\package.json" --candidate-lock "C:\proposal\package-lock.json" --format text
```

Both candidate files are required together. They are untrusted input data, not evidence that their generation was safe or authorized. Scouter does not execute them. The current project's manifest and lockfile always establish the baseline; optional `--baseline-lock FILE` must match the current lockfile byte-for-byte, preventing silent replacement of history.

The command uses the qualified npm preflight, with `locked-install` coverage because native resolution cooldowns do not recheck supplied locked versions. It accepts the existing `--npm-cli` and proposed `--npm-options` options. It cannot use `--at`, `--exceptions`, supplied evidence, or the single-package live-review options.

By default comparison is offline. For release-age checks, create an explicit public lookup permission file:

```json
["public-parent", "public-leaf", "@public-scope/tool"]
```

```powershell
node.exe src/cli.mjs compare --project "C:\path\to\project" --candidate-manifest "C:\proposal\package.json" --candidate-lock "C:\proposal\package-lock.json" --public-packages public-packages.json --format json
```

List only names whose disclosure to public npm is authorized. The file permits at most 100 unique names; it does not select which nodes get reported. Every candidate instance remains visible, and every exact artifact gets a release record. Unlisted names receive `PUBLIC_LOOKUP_NOT_AUTHORIZED` and unknown age. No automatic whole-lockfile disclosure occurs. Unsupported project registry routing or graph sources prevent all public lookups.

## Graph model and checks

The supported input is a single root with a v3 lockfile, matching manifest/root declarations, canonical exact package versions, public npm artifact origins, and SHA-512 integrity claims. Git/URL/local specs, links, workspaces, bundled layouts, package shrinkwrap, overrides, alternate resolution settings, tags, and unqualified formats are explicitly unsupported. Structural errors such as invalid paths fail as invalid input.

Declared bundled contents without separate lock entries produce `BUNDLED_DEPENDENCIES_UNVERIFIED`, rather than a misleading missing-dependency finding. This cross-platform comparison does not exclude bundles based on the host machine. The narrower target exclusion used by live `check` and `install` is described in the [workflow reference](workflow.md).

Range matching uses `semver` from the already installed, qualified npm distribution, with module-path containment checks. It does not install another dependency or load project modules. This retains the existing trust assumption for the installed toolchain. Declared registry ranges and qualified npm aliases are supported; tag/source resolution is not implemented.

Normalization preserves:

- Each lock path independently, including duplicate package versions and nested placements.
- Installed alias name and real package identity, exact version, origin, resolved URL, and integrity claim.
- Dependency edges with declaration/range, dependency category, optionality, source path, and resolved target path.
- Direct/transitive status, incoming parent paths, root reachability, and lockfile development/optional/peer flags.
- OS, CPU, libc, engine requirements, and `hasInstallScript` indications. Conditional nodes are retained even when they would not install on this machine.

Dependency lookup uses the nearest node_modules location; peer lookup starts at the containing parent location rather than accepting a peer placed inside the dependent itself. Missing required dependencies, incompatible ranges, alias identity mismatches, and unreachable instances are findings. Absent optional dependencies/peers are represented explicitly. This is a conservative validator for supplied graphs, not a reproduction of npm's ideal-tree solver or target-specific installation selection.

Comparison reports root declaration deltas separately from graph changes. Instance changes include added, removed, upgraded, downgraded, version metadata changed, identity/origin/resolved/integrity changed, outgoing-edge changed, and context changed. Moves appear as removal/addition at their exact paths. Parent paths and complete edge arrays explain relationships even when no root declaration changed.

## Release checks across the graph

Public metadata is fetched once per authorized package name, then each exact artifact/version is checked separately. Duplicate paths sharing an artifact are grouped only for lookup; their graph instances remain distinct. Unchanged candidate artifacts are checked too.

The collector applies the seven-day minimum and any stronger effective preflight cutoff. An unchanged mature parent with an unchanged dependency range can therefore produce a fresh-transitive finding when its candidate lock changes. Missing/future/invalid timestamps remain unknown. Registry claims about integrity, tarball URL, and dependency declarations are checked against the supplied lock; inconsistencies produce explicit issues rather than trusted graph evidence.

The existing [bounded metadata client](metadata.md) handles network requests. No new request begins after the 60-second graph collection budget; an already running request retains the client's bounded retry/deadline allowance. No package tarball, repository, or metadata-provided link is fetched. This command does not scan for advisories or malware.

## Snapshots and mutation limits

Supported proposals get a unique `scouter-proposal-*` directory under the system temporary directory, outside the source project. Four files are created exclusively:

- `baseline-manifest.json` and `candidate-manifest.json`: only project identity and dependency declarations/peer metadata.
- `baseline-graph.json` and `candidate-graph.json`: normalized graph data.

Scripts, arbitrary manifest config, npmrc files, credentials, hooks, and package contents are not copied. Unsupported proposals do not get a snapshot. Unsupported source specifications and credential-bearing resolved URLs are withheld from reports. Snapshots still contain dependency names and lock metadata, so treat them as project data.

The command reads each original input with the existing 4 MiB bound and rereads source manifest, lockfile, project npmrc, and candidate files after collection. Changes yield `INPUT_CHANGED`; it never restores or overwrites concurrent user edits. SHA-256 input digests and canonical graph digests record reviewed data. These checks are not an atomic snapshot of all configuration or authenticated installation bindings.

Snapshots are retained for inspection, including after interruption. No recursive deletion runs, and no computed cleanup path is passed to a shell. There is no source-tree cache or generated node_modules directory. An attacker with access to the same process/filesystem remains outside this isolation claim.

## Reports, exits, and coverage

The [graph schema](../schemas/graph.schema.json) defines `graph-review-report`, `mode: supplied-proposal`, `decision: REVIEW`, `authorization: none`, and `resolution.available: false`. JSON retains preflight, both graphs, changes, release evidence, input digests, snapshot path, issues, and limitations. Text summarizes these findings. Reports expire one hour after collection starts.

| Status | Meaning |
| --- | --- |
| `complete` | Supported graph comparison and requested candidate release collection completed; findings may still exist |
| `partial` | Release evidence is missing/unavailable/invalid, or inputs changed |
| `unsupported` | Context, baseline, source, graph layout, or consistency is outside the qualified scope |
| `unavailable` | No supplied proposal and no qualified automatic resolver |

All these statuses return REVIEW and exit **2**. Invalid invocation or structurally malformed input returns an error report and exit **4**. `complete` does not imply safe, supported, authenticated, or approved packages. The existing offline evaluator's PASS/BLOCK rules remain unchanged; this partial graph report is not a complete supplied-evidence input.

## Validation

Graph comparison tests cover graph lookup/ranges, scoped aliases, peers, optional/platform/dev coverage, moved and duplicate instances, malformed/unsupported sources, separate declaration deltas, a fresh transitive under an unchanged parent, stronger project cutoffs, registry/lock inconsistencies, privacy, input immutability, and interrupted snapshots.

The npm qualification fixture invokes only the installed trusted npm against synthetic loopback metadata in a task-owned directory, with separate empty config/cache paths, a minimal environment, native seven-day cooldown, script suppression, and Git/remote/file/directory source controls. Root and dependency manifests advertise lifecycle canaries. A separately invoked author-written positive control proves the marker code works. The lockfile-only run produced no canary marker or node_modules, requested no tarball, retained `hasInstallScript`, and preserved manifest/config bytes. Because dependency contents were never downloaded, this does not prove confinement of arbitrary dependency code or outbound traffic. Production resolution stays disabled.

Primary format references: [npm lockfile format](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/) and [npm semver implementation](https://github.com/npm/node-semver). Local npm 11.19.1 definitions were checked for the qualification flags.
