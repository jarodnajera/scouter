# npm

Apply the core; detect `packageManager`, workspace target and `npm-shrinkwrap.json`, otherwise `package-lock.json`.

| Guarded add | Cooldown | Scripts off |
| --- | --- | --- |
| `sfw npm install <pkg>@<exact> --save-exact --ignore-scripts --audit=false --cache <task-cache>` | Verified `--min-release-age=7`, otherwise `--before=<UTC-cutoff>` | `--ignore-scripts` |

- Append the verified cutoff option, preserving stricter effective settings; use `--save-dev` when intended. Snapshot authoritative dependency files, never the hidden installed-state lock. Inspect registry/TLS routing and use the same verified Node/npm paths across acquisition/builds; cache reuse can bypass Socket downloads.
- Rely on npm's normal integrity checks and native age coverage, disclosing missing timestamps and reused-lock limits. No mandatory lock-only proposal, manual graph-age lookup or duplicate hash check; inspect output/diffs and complete the core's added/changed advisory check before execution.
- Approved freshness requires installed support for operation-local `--min-release-age-exclude=<exact-name>`: it matches names, so review all admitted versions, preserve others' cutoff and stop on any unapproved match. No supported scoped exception means stop; never persist exclusions or weaken `before`/age precedence.

Necessary reviewed builds may use targeted `sfw npm rebuild <pkg>@<exact> --ignore-scripts=false --foreground-scripts`; inspect all matching instances, lifecycle hooks and implicit node-gyp behavior first.

Sources: [configuration](https://docs.npmjs.com/cli/v11/using-npm/config/#before), [install](https://docs.npmjs.com/cli/v12/commands/npm-install/), [rebuild](https://docs.npmjs.com/cli/v11/commands/npm-rebuild/). Historical resolver evidence checked 2026-10-19: npm 11.2.0; not qualification of newer age/exclusion flags.
