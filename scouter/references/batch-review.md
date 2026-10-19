# Batch review and scaled effort

Use when adding/upgrading multiple dependencies or reusing findings within a coding task. Retain the skill's [five checks and decision tiers](../SKILL.md#review-the-dependency), [manager protections](package-manager-protections.md), and [installation scope](../SKILL.md#installation-scope).

## Choose review depth

Assess each direct candidate individually, using the same five checks at either depth:

| Depth | When | Evidence and work |
| --- | --- | --- |
| Routine | Established package; corroborated intended identity; no concerning publisher signal; candidate past cooldown; no suspicious dependency or behavior changes | Brief identity corroboration, exact release metadata/age, dependency and behavior comparison, and completed advisory lookup. Reuse valid evidence and bulk results. |
| Full | Unfamiliar package, ambiguous identity or similar-name confusion, publisher change, new scripts/binaries/network behavior, fresh release, incomplete evidence, or another concrete concern | Deeper official-source corroboration and release/artifact comparison; investigate the signal and resolve gaps before READY. |

Popularity alone does not establish routine eligibility. Both depths use the same [Ready requirements](../SKILL.md#minimum-evidence-for-ready); depth changes effort, not checks or decision policy. Use full review when routine evidence is incomplete.

For five or more direct additions/upgrades across the requested task, show one compact plan before grouped resolution/install: package names and exact candidate versions, routine/full depth, shared checks, known gaps, and qualitative effort (such as mostly bulk checks versus several artifact investigations). Continue when the task already authorizes installation. Ask only for unresolved concerns, exceptions, or missing authorization; do not add a batch-size approval gate or promise a fixed completion time.

## Check the resolved graph with structured evidence

Manual research of every transitive package is unnecessary. Extract exact resolved coordinates locally from the relevant lockfile or supported proposal report, retaining dependency paths, origins, integrity, target/platform conditions, and graph changes. Deduplicate lookups without losing distinct versions, artifacts, or parent paths.

Use structured metadata, native manager controls, and local graph comparisons for transitive identity consistency, release-age coverage, advisory checks, and available dependency/behavior deltas. Inspect new/changed install scripts, binaries, source changes, and other material signals using relevant manifests or static artifact evidence. A lockfile that omits scripts does not establish their absence. Investigate flagged transitives in depth; missing required coverage remains REVIEW rather than an instruction to research everything by hand or mark it clean.

Apply the shared [age coverage rules](package-manager-protections.md#release-age-controls), retaining selected-wheel/hash binding and evidence for later uploads. Bulk checks do not expand native or Socket coverage.

## Batch public advisory lookups

Prefer OSV's [querybatch API](https://google.github.io/osv.dev/post-v1-querybatch/) for supported public packages. Send only locally extracted ecosystem/name/exact-version coordinates (for example, `npm` or `PyPI`); never upload lockfiles, manifests, project paths, source, credentials, or private coordinates. Inspect public/private registry routing before constructing requests. Report excluded/private or unsupported coverage explicitly and use an approved source when available.

Deduplicate coordinates and keep the input-to-result mapping: OSV results follow request order. Chunk requests according to current service limits. Check request success and result completeness, and follow each query's pagination token to completion. An empty completed result means no known matching advisory; a failed request, missing result, or unfinished page does not.

Batch responses contain advisory IDs and modification times. Fetch and deduplicate [advisory details](https://google.github.io/osv.dev/get-v1-vulns/) for findings before assessing affected ranges, severity, applicability, or fixes. Record source, checked coordinates/time, findings, and coverage gaps. Respect the skill's data-sharing rules: do not implicitly run `npm audit`, `pnpm audit`, `pip-audit`, or another upload service as a shortcut. Use an existing approved tool only after confirming its disclosure and coverage fit the task.

## Resolve together and install compatible groups

1. Identify all requested candidates and the baseline graph; share unchanged manager/configuration preflight. Review direct candidates before combined resolution. Keep the requested set visible instead of silently omitting a difficult dependency.
2. Group by actual manager, intended workspace/environment, and dependency category. Resolve the combined requirements using a supported proposal/lockfile workflow with script/build suppression and the relevant age/cache/source protections. Route networked package-management operations through `sfw`. Do not invent a safe dry-run or execute package code to obtain metadata; unsupported proposal coverage requires REVIEW. Inspect proposed file changes before installing.
3. Check the combined graph and shared advisory results. If any candidate or transitive concern remains unresolved, stop that planned batch before installation. Offer an eligible alternative or a clearly named subset; proceed with a subset only when it still fulfills the authorized task or the user chooses it. Re-resolve and review any changed set.
4. When ready, use the minimum compatible guarded install operations with exact reviewed versions. Preserve separate runtime/development groups where needed, explicit workspace targeting, and all manager-specific controls. Review cumulative shared-lockfile changes across groups. Before each later group, validate the updated graph; do not reuse the earlier proposal blindly. Pip keeps a guarded proposal followed by installation from complete hashed pins for that environment.
5. Inspect firewall output and resulting manifest/lockfile/report changes before executing new code. Verify the final graph against the reviewed proposal; unexpected artifacts or versions need review. On warnings needing review or failures, stop subsequent groups and report completed groups, partial changes, and unresolved requests. Never retry without the firewall or automatically undo unrelated work.

## Reuse findings within the task

Reuse evidence only for unchanged package/version/origin/artifact coordinates and compatible interpreter/platform, extras/markers, and policy conditions. Keep its source, collection time, scope, and gaps with it; reusing a finding does not expand its coverage. An unchanged declaration alone does not establish an unchanged resolved graph.

Recheck time-sensitive advisory/registry evidence before installation according to applicable freshness requirements. Invalidate affected findings when versions, artifacts/origins, graph relationships, configuration, target, policy, or relevant security evidence change. Stable identity evidence may remain reusable while changed graph/behavior checks are repeated. Preserve scoped approvals only within their recorded bounds. Summarize direct decisions and shared graph coverage without claiming every transitive package received individual manual research.

Use the [batch report format](reporting.md#batches-and-workflow-details): one line per direct candidate, a transitive coverage summary, shared gaps, and the actual operation outcome. Keep per-package decisions distinct from the overall batch disposition.
