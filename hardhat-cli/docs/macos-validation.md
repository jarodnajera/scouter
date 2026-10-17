# macOS validation

macOS support is experimental; hardware validation is pending. Apple Silicon (`darwin-arm64`) and Intel (`darwin-x64`) are separate experimental targets. Neither is validated by Windows tests that simulate a runtime descriptor.

## Prerequisites

Use a trusted checkout outside the project being assessed, Node **24.22.0**, and npm **11.19.1**. The CLI has no runtime dependencies to install. Select the intended native Node architecture; an x64 Node under Rosetta tests x64 behavior, not native arm64. Check the reported architecture and record whether translation was used.

From `hardhat-cli/`, in a macOS shell:

```sh
node -p 'JSON.stringify({node:process.versions.node,platform:process.platform,arch:process.arch})'
npm --version
sw_vers
uname -m
node src/cli.mjs --help
```

Do not upgrade/downgrade system tools automatically to satisfy these versions. Select an existing matching installation or arrange setup separately. npm discovery supports adjacent Windows layouts, Unix `lib/node_modules/npm`, and resolved `npm` symlinks on absolute PATH entries. If discovery fails for a nonstandard installation, supply the trusted absolute `bin/npm-cli.js` path.

## Run the synthetic checks

```sh
node tests/phase0/npm-capabilities.mjs --experimental-macos true
node scripts/test.mjs --experimental-macos true
```

For a nonstandard npm path, use:

```sh
node tests/phase0/npm-capabilities.mjs '/absolute/npm/bin/npm-cli.js' --experimental-macos true
HARDHAT_TEST_NPM_CLI='/absolute/npm/bin/npm-cli.js' node scripts/test.mjs --experimental-macos true
```

The harness uses local synthetic registry data and task-owned files. The integration suite uses controlled Socket runners and verifies subprocess behavior with Node; it does not download packages or require an installed Socket binary. Tests exercise no-fallback behavior, disabled scripts, preserved cutoffs, report schemas, discovery, symlinks, execute permissions, and rejected project-controlled tools. POSIX-only checks must run on the Mac rather than skip. Unsupported runtime versions fail instead of silently skipping the suite.

Review these outputs:

- `docs/evidence/npm-capabilities-darwin-arm64.json` or `npm-capabilities-darwin-x64.json`: npm capability results, OS/runtime versions, hashes, and synthetic-fixture locations.
- `.test-results/darwin-arm64.json` or `darwin-x64.json`: full-suite exit code and runtime context. Preserve the terminal test summary with this report to retain individual test results.

Run reports stay marked experimental even if tests pass. Mac results never overwrite Windows evidence. Do not commit local reports without reviewing machine paths for privacy.

## Check command gating

Choose an existing single-root public npm project with a v3 lockfile. `inspect` is read-only and does not invoke Socket or query package registries:

```sh
node src/cli.mjs inspect --project '/absolute/path/to/project' --format json
node src/cli.mjs inspect --project '/absolute/path/to/project' --experimental-macos true --format json
```

The first command must return exit 2 with `MACOS_OPT_IN_REQUIRED`. The second must report `toolchain.supportStatus: "experimental"` and `qualified: false`; it may still return exit 2 for actual missing project protections. Never waive those findings just to achieve exit 0.

The same explicit flag is available on live `review`, `compare`, `check`, and `install`. For an actual user-authorized dependency operation after the skill's review:

```sh
node src/cli.mjs check --project '/absolute/path/to/project' --public-package example --version 1.2.3 --experimental-macos true --format text
node src/cli.mjs install --project '/absolute/path/to/project' --public-package example --version 1.2.3 --experimental-macos true --format text
```

These last examples are usage templates, not required validation steps. Replace the coordinate with an actually reviewed candidate. `install` mutates the project, requires installed `sfw`, and the npm Socket launcher may download/update its own binary.

## Acceptance and promotion

For each architecture, record macOS version, Node/npm versions, native versus translated execution, npm discovery layout, harness results, full-suite output, and gating results. Require zero failed tests and no skipped POSIX permission/symlink checks. Investigate failures before promotion; do not weaken guards or simply remove failing tests.

Promotion is a separate reviewed change to the centralized support matrix and documentation after results are inspected. Testing arm64 alone does not promote x64 (or vice versa); Windows fixtures do not promote either. Existing supplied-evidence policy remains the Windows baseline and cannot emit a Mac PASS via this opt-in. Socket detection efficacy and system-wide containment are outside this qualification.
