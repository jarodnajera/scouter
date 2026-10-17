# Yarn and pnpm guarded installs

Use this reference after the skill's five dependency checks and [protection preflight](package-manager-protections.md). These workflows invoke the package manager through sfw; the optional Scouter CLI supports npm only. Guidance checked against official documentation on 2026-10-16; verify syntax against the project's installed version. Examples use placeholder package coordinates and paths, not approved dependencies. Follow the [shared version-discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies) when installed capabilities differ from these examples.

## Choose the correct workflow

For multiple additions/upgrades, use [batch review](batch-review.md): group exact candidates by workspace and dependency category, then apply the appropriate manager protections below to each grouped operation.

For a clone's initial installation, also read [first install](first-install.md). For `dlx`/`pnx`, create commands, or scaffolders, read [one-shot runners](one-shot-runners.md); ordinary add/install protections do not establish safe download-and-run behavior.

Use `packageManager`, project instructions, CI, and the existing lockfile together. Distinguish Yarn Classic (1.x, usually `.yarnrc`) from modern Yarn (`.yarnrc.yml`); `yarn.lock` alone does not identify the version. For pnpm, inspect `pnpm-lock.yaml` and `pnpm-workspace.yaml`. Do not migrate managers or regenerate another manager's lockfile.

Inspect project-selected executables, Yarn plugins/`yarnPath`, and pnpm hooks before invoking them; script suppression is not a sandbox for manager extensions. Do not bootstrap another manager through Corepack, `npx`, or `dlx` merely to read configuration. Use trusted installed tooling. Identify the intended workspace and shared lockfile before changing dependencies; avoid blanket recursive operations or root-check bypasses.

## pnpm

Use the installed version's supported configuration location. On current versions, merge these baseline settings into `pnpm-workspace.yaml` only when needed; preserve existing workspace declarations and stronger controls:

```yaml
minimumReleaseAge: 10080
ignoreScripts: true
```

Age is in minutes; support begins at 10.16.0. On versions supporting them (11+), verify `minimumReleaseAgeStrict: true` and `minimumReleaseAgeIgnoreMissingTime: false`. Inspect exclusions and `trustLockfile`: relaxed settings must not silently admit fresh, undated, or unchecked locked packages. Older versions need independent checks for unsupported protections. [Resolution settings](https://pnpm.io/settings/dependency-resolution), [configuration locations](https://pnpm.io/settings).

After checking the effective settings, use:

```text
sfw pnpm add example@1.2.3 --save-exact --ignore-scripts
```

Add `--save-dev` for development dependencies. Run in the intended workspace or use a reviewed, exact workspace filter. [pnpm add](https://pnpm.io/cli/add).

`--ignore-scripts` suppresses project/dependency lifecycle scripts, but does not suppress pnpmfile hooks. Review those separately. Inspect version-specific build allowlists; follow [build-script exceptions](build-scripts.md#pnpm) before a necessary targeted rebuild. Do not run blanket `approve-builds`, `rebuild`, or enable all builds automatically after an install reports skipped scripts. Cached build outputs also need consideration. [Build settings](https://pnpm.io/settings/build).

For a new project or compatible existing store layout, a fresh task-owned `--store-dir <absolute-empty-directory>` can avoid shared artifact reuse. Keep store integrity verification enabled. If an existing installation rejects a changed store, stop and explain; do not delete `node_modules` or force a reinstall automatically. [Store settings](https://pnpm.io/settings/store).

`pnpm store prune` removes unreferenced packages, not every cached artifact. It is not proof that the requested package will be downloaded through Socket. Review virtual-store/side-effects reuse as well; disclose any cached coverage gap. [pnpm store](https://pnpm.io/cli/store).

## Modern Yarn

On versions supporting it, preserve or merge `npmMinimalAgeGate: "7d"` in `.yarnrc.yml`. Inspect `npmPreapprovedPackages` for bypasses. `enableScripts: false` alone still permits workspace scripts and package-specific exceptions. For fresh-cache use, account for `enableGlobalCache`, `cacheFolder`, and `enableMirror`; a new local directory alone may still reuse the global mirror. Preserve stronger settings. [Yarn configuration](https://yarnpkg.com/configuration/yarnrc).

After verifying the age control and cache handling, use the installed version's documented build-skipping mode:

```text
sfw yarn add example@1.2.3 --exact --mode=skip-build
```

Add `--dev` for development dependencies. Current documentation spells the mode `skip-build`; older releases may use a different spelling or lack the option. Check local help and matching version documentation, not trial installations. Never add `--no-time-gate`. The mode suppresses this operation's build step, not future builds. [Yarn add](https://yarnpkg.com/cli/add).

If a package needs its build, follow [modern Yarn build exceptions](build-scripts.md#modern-yarn); per-package settings and name filters must be checked against the actual instances and pending builds.

For one-time cache cleanup, `yarn cache clean --all` removes local and global caches; `--mirror` targets the global cache only. Explain scope before clearing shared or committed caches. Keep zero-install archives intact unless changes are intended. [Yarn cache clean](https://yarnpkg.com/cli/cache/clean).

## Yarn Classic (1.x)

Classic does not provide modern Yarn's `npmMinimalAgeGate`. Do not put modern settings into `.yarnrc` or claim native cooldown protection. Independently review exact direct/transitive release ages and preserve the reviewed graph before installation. If that evidence is incomplete, return REVIEW instead of silently accepting a direct-package-only age check. Do not upgrade Yarn without authorization.

Once the manual review is sufficient:

```text
sfw yarn add example@1.2.3 --exact --ignore-scripts --cache-folder <absolute-empty-directory>
```

Add `--dev` as appropriate. Verify no offline mirror supplies the candidate despite the fresh cache; use `yarn cache clean` only with its shared-cache effects understood. [Classic add](https://classic.yarnpkg.com/en/docs/cli/add), [script suppression](https://classic.yarnpkg.com/en/docs/cli/install), [cache controls](https://classic.yarnpkg.com/en/docs/cli/cache).

For required builds, follow the [Classic-specific boundary](build-scripts.md#yarn-classic). Do not copy modern Yarn rebuild/configuration instructions into Classic.

## Complete the review

Inspect Socket output and manifest/lockfile diffs before running new code. For pnpm, review affected importers, snapshots, peer variants, and integrity/source entries. For Yarn, review resolved locators, checksums/integrity, peer changes, and any intended PnP artifacts. Neither a package count nor a successful exit proves all transitives were scanned.

For subsequent installs of an already reviewed graph, use supported frozen/immutable controls (`pnpm install --frozen-lockfile`, modern `yarn install --immutable`, Classic `yarn install --frozen-lockfile`) through `sfw` with the same script, age, and cache protections. Those flags preserve a graph; they neither establish its safety nor belong on an add operation that must change it. [pnpm install](https://pnpm.io/cli/install), [modern Yarn install](https://yarnpkg.com/cli/install), [Classic install](https://classic.yarnpkg.com/en/docs/cli/install).

Socket documents both managers as supported, but checks downloads, not reused artifacts. Stop on failures or warnings needing review; never fall back to an unwrapped install. [Socket Firewall Free](https://docs.socket.dev/docs/socket-firewall-free).

Use the [standalone report format](reporting.md), retaining workspace/graph scope, age method, script disposition, cache/mirror gaps, and the observed install/build outcome.
