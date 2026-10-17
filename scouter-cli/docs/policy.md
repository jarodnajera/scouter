# Supplied-evidence review policy

Revision: `phase0-policy-1`. Applies to the offline supplied-evidence evaluator, whose reports do not authorize installation. See [CLI contract and limitations](cli.md).

This policy defines the optional evaluator's evidence requirements. For the standalone review workflow, see the [skill](../../scouter/SKILL.md). It governs review decisions, not OS permissions or installation authorization. User/project requirements may explicitly replace defaults, with their source recorded. Absent, malformed, or unknown fields never disable a required check.

## Decision order

1. BLOCK for verified malware, verified identity/integrity mismatch, or an applicable unmitigated high/critical vulnerability.
2. REVIEW for any unresolved required evidence, applicable lower-severity concern, policy violation, or material suspicious change.
3. PASS only when all required evidence is complete, fresh, valid for the exact proposed graph, and policy-compliant.

Preserve BLOCK even when other evidence is incomplete. Conflicting credible security evidence requires investigation, not an automatic clean result. Applicability that cannot be determined is REVIEW. A malformed request or internal crash yields no usable decision and CLI exit 4, rather than a fabricated PASS.

## Default rules

| Rule | Policy |
| --- | --- |
| Release age | At least 604800 elapsed seconds (seven 24-hour days), inclusive, measured from exact-version publication to injected review time |
| Invalid time | Missing, malformed, or future publish time is REVIEW; no zero-age coercion or silent clock tolerance |
| Native filtering | Preserve stricter existing settings; document package-manager boundaries that are stricter than the policy's inclusive cutoff |
| Release channel | Prerelease requires REVIEW and an explicit exception if selected |
| Known release problems | Withdrawal, deprecation, unsupported status, or conflicting identity information requires resolution or REVIEW |
| Freshness | Security lookups and final decision valid for at most one hour by default; shorter provider validity wins; checked at completion and again before use |
| Policy/input changes | Immediately invalidate the prior decision, regardless of its age |
| Required providers | Vulnerability evidence and malware evidence are separate required categories; one provider may cover both only when its documented coverage supports that claim |
| Scope | All exact artifacts in the proposed graph, including dev and transitive packages; platform exclusions must be explicit, justified, and bound to the target |
| Native age control absent | Manual equivalent may qualify only with complete exact-artifact timestamps, graph preservation, and explicit disclosure; otherwise REVIEW |

The one-hour freshness window is a Scouter policy choice, not a security guarantee or a provider requirement. Metadata may be cached, but its current status must be revalidated under the same window before contributing to PASS. Cached content cannot extend its own validity merely by being read again.

## Required evidence for PASS

| Category | Required | Treatment of unknowns |
| --- | --- | --- |
| Context and compatibility | Intended manager, actual version/entrypoint, supported project shape, manifests, graph, relevant config and policy identity | Unsupported or ambiguous context is REVIEW |
| Identity | Exact package/version/origin and artifact integrity; direct package's intended official project corroborated; all transitive identities consistent with their dependency edges and registry evidence | A repository URL supplied by the package alone is insufficient corroboration; an unresolved claim is REVIEW, a verified mismatch BLOCK |
| Release data | Exact timestamps, age, release channel, current registry existence/deprecation indicators | Missing required registry fields or failed lookup is REVIEW |
| Graph and delta | Complete proposed graph; baseline or explicit new-project context; additions/removals/version/origin changes and parent paths | Missing tree coverage is REVIEW; unchanged manifest is not evidence of an unchanged graph |
| Behavior review | Script/bin/dependency manifest deltas; bounded static inspection of new/changed published artifacts and disposition of material signals | Uninspected required changes or unsupported artifacts are REVIEW; unchanged artifacts need reusable valid evidence or inspection |
| Vulnerability evidence | Successful current exact-version/range checks from a supported provider with applicability and severity | Empty complete lookup is distinguishable from unavailable/partial/unsupported results |
| Malware evidence | Successful check against a provider with documented malware coverage for the ecosystem/version; confirmation status preserved | An explicitly unscanned/unknown version is REVIEW; absence from a documented known-malware database means only no known listing, not behavioral certification |
| Manager protections | Effective settings, source/precedence, coverage, exclusions, and whether native protection or manual fallback applies | A config key's presence or an ignored flag cannot satisfy the check |
| Binding | Exact graph, manifest/config/policy digests, origins/integrities, target, review time and expiry | Changed or stale inputs invalidate the result |

`not_applicable` is permitted only with a structured, validated rule for that category, not as a blanket skip. No required category has such an exemption, so that status cannot satisfy a required check. Providers' supported coverage and collection status are distinct fields. The evaluator prevents PASS for missing required categories or empty checks and rejects unrecognized enum values.

## Optional enrichment with conditional escalation

The following may be unknown without independently preventing PASS, provided the unknown is reported and no material concern is left unresolved:

- Historic maintainer/publisher changes when no reliable history is available.
- Provenance/attestation availability, unless explicit project policy requires it.
- A public long-term-support declaration for projects that publish no support schedule. Never label unknown support as supported.
- A secondary historical baseline when the actual project baseline and required artifact review are complete.
- Informal issue chatter, popularity metrics, or download counts; none can override a security finding.

Known suspicious publisher changes, a withdrawn release, a verifiable unsupported release, or a provenance mismatch are material findings. Optional enrichment cannot be used to hide evidence already discovered. Intent corroboration remains required even when historic publisher identity is unavailable.

## Exceptions and human review

An exception identifies the authorized actor, exact artifacts, affected rule/finding, operation, rationale, creation/expiry, and policy revision. It must not silently extend to transitives or later releases. Preserve an already authorized exception within its scope instead of asking again.

Security-patch exception: review the fresh fixed version and request a narrowly scoped cooldown exception when warranted. Do not retain an older known-vulnerable version just to satisfy age policy.

Normal exception handling applies to REVIEW rules, not verified malware or integrity failures. Changing a BLOCK disposition requires an explicit policy-level decision outside the ordinary install workflow. The CLI provides no override flag for BLOCK findings.

Agent explanations can accompany evidence but cannot replace failed checks. A human disposition must be recorded separately from raw findings; never edit the original finding to make it disappear. These records are advisory workflow data, not authenticated installation permission.

## Validation

The evaluator test suite covers all three decisions, unsupported status, evidence expiry, exact seven-day boundary, invalid/future dates, empty/missing categories, malformed status, unknown provider coverage, conflicting findings, exception scope, and BLOCK precedence over missing data. JSON structure is validated before policy evaluation. The evaluator is deterministic over supplied evidence, the fixed policy revision, exception records, and a supplied clock. Runtime policy overrides are not supported.
