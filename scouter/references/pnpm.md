# pnpm

Use the core policy; verify the installed version and intended workspace/filter.

| Field | pnpm |
| --- | --- |
| Detect | `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packageManager`. |
| Guarded acquisition | `sfw pnpm add <name>@<exact> --save-exact --ignore-scripts`; add `--save-dev` where intended. Eligible routine additions can acquire directly; otherwise use a supported `--lockfile-only` proposal before frozen acquisition. Preserve importers, snapshots and peers. |
| Native cooldown | `minimumReleaseAge: 10080` in the supported configuration location; minutes, available from 10.16. Verify exclusions, `trustLockfile` and operation coverage. On supporting v11+ require `minimumReleaseAgeStrict: true` and `minimumReleaseAgeIgnoreMissingTime: false`. Unsupported/gapped coverage is Unsure. |
| Script/build suppression | `--ignore-scripts`; pnpmfile hooks are separate executable code. Inspect `onlyBuiltDependencies`, newer `allowBuilds` and higher-precedence permissions before a reviewed targeted `sfw pnpm rebuild <selector>`. |
| Cache | Compatible task-owned `--store-dir <task-store>`; retain integrity verification. Virtual-store/side-effects reuse may bypass downloads. |
| Frozen graph | `sfw pnpm install --frozen-lockfile --ignore-scripts` with the same store/age controls. |
| Gotchas | Store incompatibility is a stop, not permission to delete `node_modules` or force reinstall. No recursive rebuild, blanket build approval or root/workspace bypass. |

Approved freshness: use a temporary verified `minimumReleaseAgeExclude` exact name/version entry (10.19+ supports version qualification), bound to the reviewed graph. Older name-only controls require reviewing all matched versions. Preserve unrelated policy and restore your edits.

Documentation checked 2026-10-19: [resolution settings](https://pnpm.io/settings/dependency-resolution), [add](https://pnpm.io/cli/add), [build settings](https://pnpm.io/settings/build). Local 10.8.1 help confirms add/script options but predates the age gate; no runtime enforcement qualification.
