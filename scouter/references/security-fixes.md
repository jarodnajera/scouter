# Security fixes and remediation

Read when an advisory/audit flags an installed dependency or a security-fix cooldown exception is proposed. Apply the [core decision tiers](../SKILL.md#decide-and-install), [minimum Ready evidence](../SKILL.md#minimum-evidence-for-ready), and relevant manager workflow.

For a reported vulnerability, identify the advisory, exact installed versions, affected ranges, and direct/transitive dependency paths. Confirm whether the advisory applies to this project's version, platform, configuration, and usage; distinguish confirmed reachability from unknown reachability. Read only targeted local call sites/configuration needed for that assessment. If applicability is uncertain, return REVIEW rather than claiming the project is unaffected.

Consider remedies in this order, checking effectiveness and compatibility:

1. A documented workaround or configuration change that mitigates the vulnerable behavior without adding code. Record any functionality tradeoff and whether the vulnerable version remains installed.
2. For a transitive issue, a compatible fixed version through the manager's supported override/resolution or pip constraints mechanism. Constraints only restrict resolution; they do not update an installed environment by themselves. Preserve parent dependency compatibility and review the resulting graph.
3. A backported fix on the current release line, preferring the smallest compatible fixed version over an unrelated jump to latest.
4. A direct upgrade when the earlier options are insufficient. Apply all five dependency checks and the guarded install workflow to any changed dependency, including overrides and backports.

Do not retain an applicable serious unmitigated vulnerability solely to satisfy the cooldown. A fresh release qualifies for a security-fix cooldown exception only when **all** of these conditions hold:

- An independent advisory source (such as GHSA, OSV, or NVD) identifies the candidate as fixed. Verify its patched-version information; the package's own changelog or an unverified urgency claim is insufficient.
- The vulnerability applies to the installed dependency and is either confirmed reachable in this project or rated high/critical. Explain the urgency and why waiting or a workaround is inadequate; lower-severity issues without demonstrated reachability normally wait.
- The candidate is the smallest compatible fixed release, preferably on the current major/minor line. Explain if a larger change is necessary.
- The version comparison is available and minimal: unchanged publisher, no new dependencies, install scripts, binaries, or network behavior. Missing comparison evidence or any such change stays REVIEW regardless of the security-fix claim; confirmed malware or integrity compromise remains BLOCK.
- The waiver names exactly one package, version, and operation, with reviewed artifacts bound to that candidate. Transitive dependencies and other versions retain their normal cooldown and protections. Never use a blanket exclusion.
- The user explicitly approves that scoped cooldown waiver after seeing the advisory, applicability, version/diff evidence, and concrete proposed operation. General permission to fix a vulnerability is not approval to waive the cooldown. Reuse an existing approval only within its recorded scope.

Record the approval source, advisory ID/link, affected/fixed versions, rationale, scope, and review time in the report, for example: `cooldown waived for example@1.2.4 per GHSA-…; approved by user for this install`. Waive only release age; unresolved identity, security, integrity, behavior, or firewall concerns still prevent READY. Preserve stronger project policy unless its authorized exception process permits this waiver.

Use a verified package/version-scoped manager control if available. If a manager cannot express the narrow waiver, preserve the exact reviewed graph and manually verify every non-exempt artifact against the original cutoff; otherwise stop at REVIEW. Do not globally lower the cooldown. The optional CLI has no live-install waiver flag; an approved exception must be handled through the direct workflow with these same checks.

After mitigation or guarded installation, verify the relevant configuration or resolved graph against the advisory and inspect all affected dependency paths for remaining vulnerable copies. Report unresolved paths and any validation gaps; do not claim remediation succeeded solely because installation exited zero.

Use the [standalone report format](reporting.md), retaining all waiver/applicability details above. For mitigation without installation, identify the installed version, verified mitigation effect, and whether vulnerable code remains installed.

