# npm

Use the core policy. Templates require installed-version verification; placeholders are not approved packages.

| Field | npm |
| --- | --- |
| Detect | `package-lock.json`, `packageManager`, project instructions and workspace target. |
| Guarded acquisition | `sfw npm install <name>@<exact> --save-exact --ignore-scripts --audit=false --cache <fresh-cache>`; add `--save-dev` for development. For a guarded proposal, add `--package-lock-only`, inspect, then acquire the matching graph. |
| Native cooldown | On supporting versions, `--min-release-age=7` (days). Verify `before`, precedence, exclusions and locked-entry coverage. Unsupported/unchecked coverage is Unsure. |
| Script/build suppression | `--ignore-scripts`. For an authorized inspected build, `sfw npm rebuild <name>@<exact> --ignore-scripts=false --foreground-scripts`; review all matching instances, hooks and implicit node-gyp behavior. |
| Cache | Fresh compatible task-owned `--cache`; installed bytes can still bypass download checks. |
| Frozen graph | `sfw npm ci --ignore-scripts --audit=false --cache <fresh-cache>` only with a matching reviewed lock and authorized replacement of `node_modules`. Otherwise preserve the reviewed lock and check resulting drift. |
| Gotchas | Default npm audit sends additional data; keep it disabled. Inspect registry/TLS routing. Frozen flags do not belong on additions. |

Approved freshness: where verified, use operation-local `--min-release-age-exclude=<exact-name>` with an exact pin and reviewed lock; the exception matches names, so inspect all matching versions. No globs. Other dependencies retain the original cutoff. Otherwise use the core's bounded fallback or stop. Do not persist an exclusion.

Documentation checked 2026-10-19: [npm install](https://docs.npmjs.com/cli/v12/commands/npm-install/), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [rebuild](https://docs.npmjs.com/cli/v11/commands/npm-rebuild/). Local npm 10.2.4 help confirmed install/lock/script/cache shapes, not newer age enforcement; no live qualification implied.
