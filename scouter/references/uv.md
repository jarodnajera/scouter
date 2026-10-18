# uv guarded installs

Use for uv projects and uv's pip-compatible interface with the [Ready criteria](../SKILL.md#minimum-evidence-for-ready). Eligible routine work uses [routine preflight](routine-review.md), common sections here and its selected workflow; linked exception guides are conditional. Other work requires [manager preflight](package-manager-protections.md) and [Socket assessment](socket-operations.md); multiple dependencies require [batch review](batch-review.md). Documentation checked on 2026-10-17. Commands below require local verification, not live-tested compatibility claims. Follow the [discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies) when capabilities differ.

## Environment, sources, and protections

Use the trusted installed uv and intended existing Python interpreter/environment. Inspect `pyproject.toml`, `uv.lock`, relevant `uv.toml`, inherited configuration, index routing, `tool.uv.sources`, workspace members, extras/groups, markers, and `.python-version`. Keep private coordinates local. Socket documents uv/public-registry support; that does not establish coverage for Git, local files, custom indexes, Python downloads, or arbitrary tool execution. [Socket support](https://docs.socket.dev/docs/socket-firewall-free).

Verify the installed subcommands' help against the [uv CLI](https://docs.astral.sh/uv/reference/cli/). The examples use `--python <python-path>` and `--no-python-downloads`; do not let interpreter discovery bootstrap a runtime. Confirm the environment location and permitted creation/replacement effects. Never use `--system` or substitute another Python manager to make a command work.

If a required control is unavailable, use a documented equivalent or return REVIEW with the gap. Do not silently omit flags, upgrade uv, or perform trial installs to discover whether protections work.

Use `--exclude-newer <UTC-cutoff>` for new resolution, at least seven days old or the stronger project cutoff. Verify duration support before using relative forms. Inspect per-package overrides and source/index upload-time coverage; check locked/selected artifacts separately. Missing timestamps or incomplete native coverage require the exact-artifact fallback, not a cooldown exclusion. [uv resolution](https://docs.astral.sh/uv/concepts/resolution/), [settings](https://docs.astral.sh/uv/reference/settings/).

Preflight local/editable/VCS/direct-URL requirements and dynamic metadata before resolution. Default to public registry wheels. `--no-build` rejects source builds but can reuse cached built wheels and does not prevent first-party/workspace or editable backends from executing. `--no-build-isolation` and `--no-editable` are not substitutes. Stop for separate review of these sources/builds; do not silently erase `tool.uv.sources` or reroute packages. Verify build exceptions against [uv settings](https://docs.astral.sh/uv/reference/settings/#no-build).

The [JavaScript build-script exception workflow](build-scripts.md#python-boundary) preserves this Python boundary; it does not authorize uv backend execution or removing project/workspace exclusions.

Use `--no-cache` or a verified fresh task-owned cache. No-cache operations still use temporary storage; neither cache isolation nor refresh flags rescan installed bytes. Disclose reuse gaps without purging shared caches automatically. [uv caching](https://docs.astral.sh/uv/concepts/cache/).

## Project workflow

For an addition, after direct candidate/source review, resolve without syncing the environment:

```text
sfw uv --no-cache --no-python-downloads add "example==1.2.3" --no-sync --no-build --exclude-newer <UTC-cutoff> --python <python-path>
```

This changes project declarations and the lockfile; inspect those diffs before installation. Preserve group/extra/workspace targeting rather than applying root-wide changes. For upgrades, choose the exact reviewed candidate within compatible declarations; use a scoped lock upgrade when only a transitive lock entry should change, with the same protections. Do not use blanket `--upgrade`. [Managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/).

For a lock-only upgrade within the existing compatible constraints:

```text
sfw uv --no-cache --no-python-downloads lock --upgrade-package "example==1.2.3" --no-build --exclude-newer <UTC-cutoff> --python <python-path>
```

Review the resulting exact graph and target artifacts, dependency/behavior changes, and bulk advisory results. A universal `uv.lock` may contain alternatives for multiple targets: identify the installed subset and justify exclusions; do not claim excluded artifacts were checked. Associate each permitted wheel with its registry origin, hash, upload date, Python/platform compatibility, and yanked status. Review later uploads individually. These wheel checks apply to both uv workflows; no pip-guide read is required. Artifact lists/hashes alone do not establish age or safety.

After READY, install third-party dependencies while excluding unreviewed project/workspace builds:

```text
sfw uv --no-cache --no-python-downloads sync --locked --no-build --no-install-project --no-install-workspace --exclude-newer <UTC-cutoff> --python <python-path>
```

Apply the reviewed group/extra selection. `--locked` checks lock consistency and fails instead of updating it; `--frozen` skips that consistency check. Neither rechecks every locked package's age. Sync is exact by default and can remove extras from the environment; assess that impact first. Excluding the project/workspace is a dependency-acquisition stage; report that the application itself still needs separate installation/build review. Do not remove these exclusions merely because imports fail. [Locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/).

Before using even the dependency-only command, resolve all other local/editable inputs needing backend execution: workspace exclusions do not exclude arbitrary local dependencies. Do not run `uv run`, `uv tree`, or exports casually during inspection; some uv operations lock/sync automatically. Use verified no-update/no-sync inspection modes or read the lockfile locally.

## Pip-compatible workflow

For projects already using uv's requirements interface, resolve the intended combined input without installing it:

```text
sfw uv --no-cache --no-python-downloads pip compile <reviewed-input.txt> --generate-hashes --no-build --exclude-newer <UTC-cutoff> --python <python-path> --output-file <proposed-pins.txt>
```

Preserve constraints, requested extras/groups, markers, and target conditions. Review the proposal and all accepted artifact hashes; generated hashes may cover more than the one wheel selected on this machine. Narrow them to reviewed compatible artifacts when necessary. Keep the graph complete and every requirement pinned. [Locking environments](https://docs.astral.sh/uv/pip/compile/).

```text
sfw uv --no-cache --no-python-downloads pip install --require-hashes --no-build --exclude-newer <UTC-cutoff> --python <python-path> -r <reviewed-pins.txt>
```

Install does not save project declarations or remove all extraneous packages. If the project requires `uv pip sync`, first review its exact-environment/removal effects and use the same verified hash/build/cache/source controls. No pip flags are assumed valid for uv without checking help. Local/editable and first-party exceptions remain subject to preflight even with `--no-build`.

Inspect firewall output and resulting environment/lock/report evidence before executing code; compare installed versions/origins with the reviewed graph, and disclose already-satisfied/cache coverage. Stop on warning/failure or graph drift without plain-manager retries, automatic relocking, or undoing unrelated changes. For a clone, also follow [first install](first-install.md); for `uvx`, follow [staged runners](one-shot-runners.md).

Use the [core report](../SKILL.md#single-package-report) for routine work, otherwise [reporting](reporting.md). Distinguish lock/proposal changes, environment installation, excluded project/workspace builds, and pending execution; retain wheel-age/hash and cache-coverage details.

## Poetry limitation

Scouter has no documented guarded Poetry workflow. Report REVIEW with that limitation and preserve `poetry.lock`, configuration, and the selected manager. Do not claim `sfw poetry install` support, export/migrate to pip/uv, or regenerate another lockfile implicitly. Present an approved-tool or explicitly requested migration option separately.
