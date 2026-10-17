# First install of an existing project

Read before the first dependency installation from a clone, archive, or existing checkout whose graph has not been reviewed in this task, even when no versions are changing. Use the [Ready criteria](../SKILL.md#minimum-evidence-for-ready), [batch checks](batch-review.md), and [manager protections](package-manager-protections.md). Documentation checked on 2026-10-17; examples need verified installed-version support and the additional controls below. Follow the [shared version-discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies) when installed capabilities differ from these examples.

## Review before changing the environment

Identify project/workspace instructions, actual manager/version, intended registry, selected dependency groups/platform, interpreter, and manifest/lockfile pair. Inspect relevant configuration and executable extensions/hooks before invoking a manager. Do not bootstrap missing managers, run repository setup scripts, execute `setup.py`, or source shell files to discover dependencies.

Extract the locked graph locally and check exact versions, origins/integrity, dependency paths, install behavior, and public advisory results using batch review. A committed lockfile is input evidence, not prior approval. No historical baseline is needed for a first install; inspect the current graph/artifacts instead. Missing graph data needed for these checks remains REVIEW.

Check release ages independently for locked artifacts outside verified native coverage. Preserve stronger cooldowns, pip/uv selected-wheel upload dates, and existing scoped exceptions. Frozen/immutable controls preserve versions; they do not establish age, advisory, or malware coverage. Follow Socket's cache rules and disclose installed/reused artifacts that will not download.

Before choosing a clean/exact install, inspect existing `node_modules` or Python environment metadata and local changes. npm CI removes `node_modules`; exact sync can remove unrelated packages. Use an intended disposable/project environment only when replacement fits the authorized task. Otherwise explain the impact and resolve the environment choice before invoking it; do not silently delete or force replacement.

## Guarded install paths

Run in the intended project/workspace. These are command shapes, not a substitute for the preflight or graph review. Keep the reviewed source/TLS, age/fallback, cache, script/build, and dependency-group controls on every operation. Disable automatic audit uploads unless separately approved; use the coordinate-only batch advisory workflow instead.

| Manager | Guarded command shape | Additional controls |
| --- | --- | --- |
| npm | `sfw npm ci --ignore-scripts --audit=false --cache <fresh-task-cache>` | Require a consistent npm lockfile and matching resolution configuration. Check locked ages separately; preserve verified age settings. Do not run `npm install` to repair a mismatch automatically. [npm CI](https://docs.npmjs.com/cli/v11/commands/npm-ci/) |
| pnpm | `sfw pnpm install --frozen-lockfile --ignore-scripts` | Apply the [pnpm guide](yarn-pnpm.md#pnpm), including hook/build settings and compatible fresh store/cache handling. Never fix store incompatibility with automatic deletion or `--force`. [pnpm install](https://pnpm.io/cli/install) |
| Modern Yarn | `sfw yarn install --immutable --mode=skip-build` | Verify mode spelling and cache/mirror protections from the [Yarn guide](yarn-pnpm.md#modern-yarn). Preserve immutable-cache policy where present; do not modify committed archives implicitly. [Yarn install](https://yarnpkg.com/cli/install) |
| Yarn Classic | `sfw yarn install --frozen-lockfile --ignore-scripts --cache-folder <fresh-task-cache>` | Apply manual exact-artifact ages and inspect offline mirrors. Do not infer the major version from `yarn.lock` alone. [Classic install](https://classic.yarnpkg.com/en/docs/cli/install/) |
| pip | `sfw <python-path> -m pip install --require-hashes --only-binary=:all: --no-cache-dir -r <reviewed-pins.txt>` | Require complete reviewed pins/hashes, target environment, and verified cutoff or manual age checks from the [pip guide](pip.md). A bare requirements file is not necessarily a lockfile. |
| uv project | Guarded `uv sync --locked` with the [uv dependency-only controls](uv.md#project-workflow) | Require an up-to-date reviewed `uv.lock`; skip unreviewed project/workspace installation and builds, select intended groups, and check removal effects. |

If the lockfile is missing, stale, inconsistent, or incompatible with the installed manager, stop this frozen-install path. Prepare and review a proposed graph using the existing manager workflow when authorized; explain any necessary dependency-file change. Do not silently regenerate locks, use `--no-frozen-lockfile`, or substitute another manager. For pip input without complete pins/hashes, follow its separate guarded proposal workflow rather than installing unchecked ranges.

## Inspect before running code

Keep project builds, install-script exceptions, local/editable package installation, and application startup separate from acquiring reviewed dependencies. In particular, Python project installation can invoke a build backend even when third-party packages are wheels. Follow [uv](uv.md) or [pip](pip.md) restrictions rather than assuming a clone is trusted executable code.

When a reviewed JavaScript dependency needs its suppressed build, follow [scoped build-script exceptions](build-scripts.md) before running it; do not repeat the entire install with scripts enabled.

Inspect firewall output and resulting environment/report metadata. Confirm expected versions and unchanged lockfile contents, account for exclusions and cached/already-satisfied packages, and report flagged findings or incomplete checks. Stop on warnings requiring review or failures; report partial environment/file changes without unwrapped retries or automatic rollback. Verify any authorized project build separately before importing or launching the application.

Use the [standalone report format](reporting.md), naming the project/target graph, environment effects, changed files, and any pending project build or execution. Use batch coverage summaries for multiple direct dependencies.
