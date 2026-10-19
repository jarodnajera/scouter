# npm

Use the core policy. Templates require installed-version verification; placeholders are not approved packages.

| Field | npm |
| --- | --- |
| Detect | `npm-shrinkwrap.json` (takes precedence), otherwise `package-lock.json`; `packageManager`, project instructions and workspace target. Snapshot the authoritative lock and manifest before mutation; do not use `node_modules/.package-lock.json` as the baseline. |
| Guarded acquisition | `sfw npm install <name>@<exact> --save-exact --ignore-scripts --audit=false --cache <task-cache>` plus the verified cooldown below; add `--save-dev` for development. Command names are shorthand for verified executable/runtime paths. Eligible routine additions need no separate proposal. For staged review, add `--package-lock-only`, inspect, then acquire the matching graph. |
| Native cooldown | Prefer verified `--min-release-age=7` (days); otherwise supported `--before=<UTC-cutoff>` is a native fallback. Compute the absolute seven-day cutoff once at operation start and retain it through all stages. Absence of `min-release-age` alone does not require REVIEW. Apply the coverage conditions below. |
| Script/build suppression | `--ignore-scripts`. For an authorized inspected build, `sfw npm rebuild <name>@<exact> --ignore-scripts=false --foreground-scripts`; review all matching instances, hooks and implicit node-gyp behavior. |
| Cache | Compatible task-owned `--cache`; installed bytes can still bypass download checks. |
| Frozen graph | `sfw npm ci --ignore-scripts --audit=false --cache <task-cache>` only with a matching reviewed lock and authorized replacement of `node_modules`. Otherwise preserve the reviewed lock and check resulting drift. |
| Gotchas | Default npm audit sends additional data; keep it disabled. Inspect registry/TLS routing. Frozen flags do not belong on additions. |

Before choosing flags, inspect effective `before`, age and exclusion settings against installed-version configuration/source. Preserve any stricter cutoff (the earlier absolute date or longer age window); do not let CLI precedence relax it. On versions supporting both settings, verify same-source and cross-source precedence and whether exclusions affect both. Use operation-local flags, not persistent configuration edits; a new stage must not advance the original cutoff.

`--before` filters registry resolution, including transitive selections, but does not establish that reused locked entries were age-checked. Routine additions require covered new resolution and adequate prior age evidence for reused entries relevant to acquisition. Unverified prelocked additions, missing publication timestamps or unsupported source coverage remain REVIEW; do not delete/regenerate locks to evade this boundary. Older npm resolvers can admit versions with missing timestamps. Neither a successful exit nor the presence of `--before` proves complete coverage. Unchanged installed dependencies are not newly reviewed.

Approved freshness: verify operation-local `--min-release-age-exclude=<exact-name>` support before use. It matches names, not versions: inspect every matching graph instance and stop if it admits an unapproved version. Use an exact pin and preserve the reviewed graph; no globs. Every non-exempt dependency retains the original cutoff, including the approved package's dependencies. Inspect effective `before`/age precedence. Confirm the operation leaves project, user and global configuration unchanged. Otherwise use the core's bounded fallback or stop; do not persist an exclusion.

Documentation checked 2026-10-19: [npm install](https://docs.npmjs.com/cli/v12/commands/npm-install/), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [rebuild](https://docs.npmjs.com/cli/v11/commands/npm-rebuild/). Local npm 10.2.4 help confirmed install/lock/script/cache shapes, not newer age enforcement; no live qualification implied.

Fallback review 2026-10-19: [npm configuration and before](https://docs.npmjs.com/cli/v11/using-npm/config/#before) and installed npm 11.2.0 resolver source. Current online v11 docs describe a newer minor; their newer flags/precedence are not proof of local support. Earlier live evidence demonstrated fresh direct rejection only; no blanket locked-entry or Socket qualification is implied.
