# Routine review

Use with the core for one established public package in an existing single-root project. Confirm official identity, consistent publisher evidence, mature artifacts, complete graph and static behavior evidence, and no unresolved concern; popularity alone is insufficient. Start provisionally, then escalate any failed eligibility check. Keep all five checks and Ready requirements.

## Shared preflight

Identify project instructions, manager/version, manifests/locks, dependency category, target/environment, baseline and local changes. Use trusted installed executables; inspect project hooks/plugins and auto-downloading shims before invoking help. Verify effective configuration, precedence, units, exclusions and operation coverage against installed help and matching official documentation/source. Help may omit configuration-only settings. Native enforcement satisfies covered checks; printed settings alone do not prove coverage. Uncertainty requires the [discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies), not invented flags, upgrades or trial installs.

Before first Socket use, verify its trusted launcher, availability and update behavior: the npm launcher can download/update a native binary. Confirm network permission and actual artifact/operation coverage, not just documented manager support. Mandatory telemetry includes coordinates, machine identifier, timing/errors and potentially GitHub organization; it cannot be disabled. Check policy compatibility and registry routing/authentication without exposing or silently stripping credentials. Vendor documentation is not an independent traffic audit. Stop and read [Socket operations](socket-operations.md) for unavailable tooling, unsupported coverage, prohibited telemetry or uncertainty.

## Review and acquire

1. Corroborate direct identity independently; compare installed or preceding stable versions and inspect relevant published manifests/artifact sources statically. Review dependency, publisher, script, executable, network, and credential changes. Missing necessary comparisons or suspicious changes need full review.
2. Extract the exact complete target graph locally: versions, edges, origins, integrity and relevant deltas. Use structured checks for transitives, investigating concrete signals rather than manually researching every package. Establish each artifact's release status and seven-day/stronger cutoff through verified native coverage or manual dates. Check uncovered locks, exclusions and missing timestamps manually; preserve the graph. Unresolved age gaps or fresh transitives remain REVIEW.
3. Complete exact-version/range advisory coverage for every applicable public coordinate. Prefer OSV querybatch: deduplicate locally extracted ecosystem/name/version inputs, map results to request order, respect limits, finish per-query pagination, and fetch advisory details for findings. Failed/partial/unsupported lookups remain gaps; completed empty results mean no known findings. Assess relevant malware reports. Never upload project metadata or implicitly invoke audit services.
4. Resolve through `sfw` without executing package code, using a verified proposal path. Inspect proposed graph/artifacts before acquisition; no supported path means REVIEW. Pin reviewed versions, preserve the graph, suppress unreviewed builds/scripts, and use compatible fresh task-owned caches. Do not purge shared caches. Reused caches/installed bytes may bypass download checks; disclose coverage. Check replacement/removal effects before clean/exact installs.
5. Under existing authorization, attempt guarded installation; inspect firewall output, graph and file/environment changes before any new code. Stop on warnings, failures or drift; report partial changes without unwrapped retries or automatic rollback. Use the core report, distinguishing pending functionality checks.

Reuse findings only within this task for unchanged coordinates/artifacts, graph, target, configuration and policy. Retain sources/times/gaps; refresh time-sensitive evidence before installation. Changes invalidate affected findings. Use [batch review](batch-review.md) for larger reuse/grouping.

## Manager instructions and escalation

Read: [npm](package-manager-protections.md#routine-npm), [pnpm or Yarn](yarn-pnpm.md), [pip](pip.md), or [uv](uv.md). Only that manager's sections apply. Python selected-wheel age evidence/hashes and separate proposal/install stages remain mandatory.

Outside eligibility, load detailed protection/Socket guidance and relevant [batch](batch-review.md), [first-install](first-install.md), [runner](one-shot-runners.md), or [build](build-scripts.md) workflow before proceeding. Workspaces, setup problems and suspicious changes need this escalation. Specialized reports require [reporting](reporting.md). Unsupported Poetry/pipx coverage is unchanged.
