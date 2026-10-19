# npm

Apply the core; verify installed-version support, not template placeholders.

| Operation | Controls |
| --- | --- |
| Baseline | Snapshot manifest and `npm-shrinkwrap.json`, otherwise `package-lock.json`; never the hidden installed-state lock. Respect workspace and manager settings. |
| Acquisition | `sfw npm install <name>@<exact> --save-exact --ignore-scripts --audit=false --cache <task-cache>`; add `--save-dev` when appropriate. Use verified absolute paths/runtime. Staged proposals add `--package-lock-only`. |
| Cooldown | Verified `--min-release-age=7` (days), otherwise `--before=<UTC-cutoff>`. Compute once; preserve stricter effective settings and original cutoff throughout. |
| Build | After inspection: `sfw npm rebuild <name>@<exact> --ignore-scripts=false --foreground-scripts`. Review matching instances and implicit node-gyp hooks. |
| Frozen graph | `sfw npm ci --ignore-scripts --audit=false --cache <task-cache>` requires reviewed matching lock and authorization to replace `node_modules`. |

Verify age/before/exclusion precedence against installed configuration/source. Use operation-local flags; never weaken existing policy or persist exceptions. Inspect registry/TLS routing. Cached bytes can bypass Socket.

## Timestamp fallback

Some npm resolvers admit missing timestamps under `--before`; reused locks also bypass resolution. This theoretical limitation alone does not require a proposal or approval: routine guarded acquisition may proceed with graph-age checks explicitly pending before execution. Unsupported registry/source coverage still requires REVIEW.

Where native coverage has this gap, independently verify deduplicated added/changed public coordinates, optional entries and reused locked coordinates newly entering acquisition. Reuse fresh metadata. Fetch remaining full metadata once per package in **one command**, concurrency four, bounded request timeouts; extract exact-version publish times locally against the original cutoff. Keep raw metadata task-local, never print it. Output only `package | version | publish time | PASS/FAIL`, short failure reasons and totals. No permanent helper framework. One command may make multiple requests; record permissions separately.

Missing/invalid timestamps, failed lookups or fresh versions stop execution for REVIEW. Never regenerate locks to evade checks. This fallback is npm-specific, not a requirement for other managers.

Approved freshness requires verified exact-name exclusions, checking every matching version and preserving other artifacts' cutoff; otherwise use the core's frozen-graph fallback or stop.

Evidence checked 2026-10-19: installed npm 11.2.0 resolver; [configuration](https://docs.npmjs.com/cli/v11/using-npm/config/#before), [install](https://docs.npmjs.com/cli/v12/commands/npm-install/), [ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/), [rebuild](https://docs.npmjs.com/cli/v11/commands/npm-rebuild/). Online versions do not establish local flag support or live qualification.
