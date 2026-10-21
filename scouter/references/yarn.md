# Yarn

Apply the core and installed major's section. Inspect `yarnPath`, plugins and hooks before invocation; a lockfile alone does not establish the version.

## Classic

| Guarded add | Cooldown | Scripts off |
| --- | --- | --- |
| `sfw yarn add <pkg>@<exact> --exact --ignore-scripts --cache-folder <task-cache>` | None: REVIEW and ask | `--ignore-scripts` |

- Keep Classic; do not migrate managers. Review direct age, disclose missing native transitive cooldown and obtain scoped acceptance. A fresh candidate without a supported scoped exception must stop.
- Preserve lock/registry settings; inspect offline mirrors and cache reuse without purging shared artifacts. Add `--dev` when intended.

## Modern

| Guarded add | Cooldown | Scripts off |
| --- | --- | --- |
| `sfw yarn add <pkg>@<exact> --exact --mode=skip-build` | Verified `npmMinimalAgeGate: "7d"` | `--mode=skip-build` |

- Prefer a verified operation-local setting; tell the user before enabling policy in `.yarnrc.yml`. Inspect effective preapprovals, build permissions and cache/global mirror behavior; preserve stronger policies and committed caches.
- `npmPreapprovedPackages` bypasses multiple gates: never use it for a freshness exception. Without a verified age-only scoped exception, stop. Preserve the original cutoff and restore temporary changes; add `--dev` when intended.

For either version, run only necessary reviewed builds bounded to all matching instances; no blanket permissions. Classic needs a verified package-local invocation; modern Yarn can use reviewed per-package settings and targeted `sfw yarn rebuild <name>`.

Sources: [Classic](https://classic.yarnpkg.com/en/docs/cli/install/), [modern add](https://yarnpkg.com/cli/add), [settings](https://yarnpkg.com/configuration/yarnrc). Documentation checked 2026-10-19; not modern-Yarn live qualification.
