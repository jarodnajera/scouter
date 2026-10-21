# pnpm

Apply the core; detect `pnpm-lock.yaml`, `pnpm-workspace.yaml`, installed version and intended workspace/filter.

| Guarded add | Cooldown | Scripts off |
| --- | --- | --- |
| `sfw pnpm add <pkg>@<exact> --save-exact --ignore-scripts` | Verified `minimumReleaseAge: 10080` (minutes) | `--ignore-scripts` |

- Age support starts at 10.16. Prefer verified operation-local settings; if project configuration is necessary, tell the user before editing `pnpm-workspace.yaml`. Preserve stronger policy, exclusions and effective precedence; where supported retain strict/missing-time controls. Missing age support is REVIEW, not permission to migrate tooling.
- Inspect executable pnpmfile hooks separately from lifecycle suppression. Preserve lock importers/peers, registry routing and integrity enforcement; use a compatible task store when needed. Store/side-effects reuse can bypass downloads; store failures do not authorize deletion, force reinstall or unwrapped retries.
- Approved freshness may use verified `minimumReleaseAgeExclude` with exact name/version qualification (10.19+). Older name-only controls require reviewing every matched version; stop on unapproved matches, retain other cutoffs and leave no persistent relaxation.

Use `--save-dev` for development dependencies. Necessary builds require inspected package/version permissions and a targeted `sfw pnpm rebuild <selector>`; no blanket approvals or recursive rebuilds.

Sources: [resolution settings](https://pnpm.io/settings/dependency-resolution), [add](https://pnpm.io/cli/add), [build settings](https://pnpm.io/settings/build). Historical documentation check: 2026-10-19; local 10.8.1 help predates native age support, not current enforcement qualification.
