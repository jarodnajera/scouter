# CLI compatibility

These limits apply to the optional CLI. The [standalone skill](../../hardhat/SKILL.md) supports direct package-manager workflows independently of this matrix.

## Supported toolchains

| Component | Requirement |
| --- | --- |
| Node.js | 24.22.0 |
| npm | 11.19.1 |
| Windows | x64 validated; tests run on kernel 10.0.26300 |
| macOS | arm64 and x64 experimental; validation pending separately for each architecture |
| Linux | Unsupported |
| Project layout | Single root, no workspaces |
| Lockfile | v3 `package-lock.json` |
| Registry | Public npm registry over HTTPS |

Live macOS commands require `--experimental-macos true`. The flag changes platform eligibility only; version, registry, script, freshness, and dependency checks still apply. See [macOS validation](macos-validation.md) for commands and acceptance criteria.

Reports classify toolchains as `validated`, `experimental`, or `unsupported`. `qualified` is true only for validated combinations. Successful experimental execution does not promote support. Offline supplied-evidence evaluation retains its Windows evidence policy.

Other runtime versions are unsupported, not necessarily incompatible. Re-run compatibility tests and review changed behavior before expanding the matrix. These tests do not authenticate the installed toolchain or establish package safety.

## Tool discovery

The CLI resolves the project, runtime, npm, and Socket paths before checking that tool entrypoints are outside the project. Explicit `--npm-cli` selection takes precedence; an invalid explicit path fails without fallback. Automatic discovery checks Node-adjacent installations, Unix prefix layouts, and resolved npm symlinks on absolute PATH entries.

JavaScript entrypoints run through the selected Node executable with argument arrays and `shell: false`. Shell wrappers are not executed. Preflight loads the selected npm installation's native config library in a bounded helper. See [preflight usage and limits](preflight.md) and [Socket setup](workflow.md#one-time-setup).

## Reproduce

From the repository root on the validated Windows toolchain:

```powershell
node ./hardhat-cli/tests/phase0/npm-capabilities.mjs
```

For a nonstandard npm location, supply its absolute entrypoint:

```powershell
node ./hardhat-cli/tests/phase0/npm-capabilities.mjs 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'
```

The harness uses synthetic loopback registry metadata, separate empty npm configuration files, and per-fixture caches and logs. It downloads no package artifacts. An explicitly invoked, author-written positive control writes a marker in its fixture directory to verify script-detection assertions. Minimal configuration and environment controls are not an OS sandbox.

Exit 2 means an unsupported toolchain; exit 1 means an assertion failed; exit 0 means the fixtures passed. Passing fixtures do not approve a dependency.

Results are written to `docs/evidence/npm-capabilities-<platform>-<arch>.json` and record versions, timestamps, hashes, assertions, and limits. Raw reports are ignored by Git because they contain machine-specific paths. The tested Windows baseline and outcomes are summarized below. Fixture files remain in the ignored `.phase0-runs/` directory for local inspection. Review and redact any report before sharing it separately.

The full suite runs separately with `node scripts/test.mjs` from `hardhat-cli/` and writes `.test-results/<platform>-<arch>.json`. Follow the [macOS validation instructions](macos-validation.md) for experimental runs. Neither report automatically changes support status.

## Tested npm behavior

The capability harness checks:

- A seven-day cooldown excludes fresh direct and transitive releases, including an exact fresh version with no eligible alternative.
- An absolute cutoff applies to resolution and takes precedence over the relative cooldown when both are supplied on the command line.
- Project configuration, command-line overrides, and package exemptions affect release-age filtering.
- Script suppression prevents root lifecycle execution during lockfile-only resolution, without creating `node_modules` or changing the manifest.
- Explicit `npm run` still executes its requested script despite `--ignore-scripts`.
- Previously locked releases are not necessarily revalidated by a cooldown.

All 14 capability checks passed on the recorded Windows baseline. In the existing-lock fixture, a one-hour-old transitive release remained locked after enabling the seven-day cooldown. Independently check locked versions; a successful configuration lookup does not establish resolution behavior.

The separate graph comparison tests check advertised lifecycle scripts using synthetic lockfile-only fixtures. Because package contents are not downloaded, these tests do not establish confinement of dependency code, native builds, or outbound traffic. Socket adapter tests use controlled runners and do not measure Socket's detection efficacy.

## Project and command limits

Unsupported inputs produce explicit findings without automatic conversion:

- Missing required baselines, non-v3 locks, shrinkwrap, workspaces, or conflicting manager declarations.
- Non-npm managers, unsupported toolchains, or unknown option behavior.
- Private/custom registries and Git, URL, local, or linked dependencies.
- Executable configuration and unsupported dependency layouts.

Metadata review supports explicit direct root npm aliases for baseline identity. Supplied-proposal graph comparison supports registry ranges and explicit aliases, but excludes tags, overrides, bundled layouts, links, and workspaces. It preserves peer, optional, development, and platform conditions without reproducing npm's resolver or target-specific installation filtering. See [graph coverage](graph-comparison.md).

The compare command requires an externally prepared candidate manifest and lockfile; it does not generate them. The separate install command performs an authorized, guarded installation in the project. Neither command provides OS-level isolation. Metadata and graph reports cannot replace missing identity, artifact, vulnerability, or malware evidence.

## References

- [npm 11.19.1 config definitions](https://github.com/npm/cli/blob/v11.19.1/workspaces/config/lib/definitions/definitions.js): cutoff precedence, units, exemptions, and script controls.
- [Package-manager protections](../../hardhat/references/package-manager-protections.md): standalone workflow guidance. Check behavior against the installed version when documentation differs.
