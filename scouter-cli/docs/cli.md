# CLI and evidence contract

The [standalone skill](../../scouter/SKILL.md) is the primary workflow and invokes `sfw` directly. This CLI is an optional helper; its runtime restrictions and setup requirements apply only when using the CLI.

**Start with the [focused check/install workflow](workflow.md).** The commands below provide optional advanced diagnostics.

Version: 0.1.0. The primary workflow checks dependencies and routes explicitly requested installs through a local sfw npm launcher or native executable. The optional diagnostics provide offline evidence evaluation, npm preflight, public metadata/release comparison, and supplied-proposal graph comparison. The CLI does not enforce a system-wide installation policy.

## Run locally

No dependency installation is required. From the repository's `scouter-cli/` directory:

```powershell
node.exe src/cli.mjs --help
node.exe src/cli.mjs inspect --project "C:\path\to\project" --format text
node.exe src/cli.mjs review --evidence tests/fixtures/pass.json --at 2026-10-16T18:00:00.000Z --format text
node.exe src/cli.mjs review --evidence tests/fixtures/review.json --at 2026-10-16T18:00:00.000Z --format json
node.exe src/cli.mjs review --evidence tests/fixtures/block.json --at 2026-10-16T18:00:00.000Z
node.exe src/cli.mjs inspect --evidence tests/fixtures/unsupported.json --at 2026-10-16T18:00:00.000Z
```

The macOS equivalent uses `node` and POSIX paths, with `--experimental-macos true` on live commands. Actual Mac validation is pending; see [macOS validation](macos-validation.md). Offline supplied-evidence commands do not accept this flag and retain their Windows evidence policy.

`--at` supplies a reproducible evaluation clock for fixtures. Omitting it uses current UTC time, so the saved fixtures will eventually yield REVIEW for stale evidence. Rewinding the clock is a simulation, not permission to use expired security evidence in a real installation.

Review exit codes: PASS 0, REVIEW 2, BLOCK 3, invalid input or internal failure 4. Inspection complete is 0 and review/unsupported is 2; inspection never returns a dependency decision. Errors have their own `error-report` kind with no decision field.

JSON is the default output format and stdout contains one report. Error diagnostics go to stderr. Unknown commands/options, duplicate options, missing arguments, malformed JSON, and schema violations produce exit 4. Advanced `--project` commands support `inspect`, partial live `review`, and supplied-proposal `compare`; the primary `check` and `install` commands are documented separately above.

For [actual lockfile graph comparison](graph-comparison.md):

```powershell
node.exe src/cli.mjs compare --project "C:\path\to\project" --candidate-manifest "C:\proposal\package.json" --candidate-lock "C:\proposal\package-lock.json" --format text
```

Comparison is offline by default. Optional `--public-packages FILE` permits release lookups for the JSON array of public names in that file. Optional `--baseline-lock FILE` must match the current project lock exactly. Omitting both candidate files returns explicit REVIEW because automatic resolution lacks a qualified isolation boundary. Comparison reports always exit 2 and never grant installation approval.

For [live registry metadata and release comparison](metadata.md):

```powershell
node.exe src/cli.mjs review --project "C:\path\to\project" --public-package is-number --version 7.0.0 --format text
```

`--public-package` explicitly permits disclosure of that name to public npm. For an existing alias, also supply `--dependency <alias>`. Live metadata reports always return REVIEW (exit 2), including successful collection: required graph, artifact, identity corroboration, and scanner evidence remain incomplete. This command cannot use offline exceptions or a simulated clock.

See [live preflight usage and limits](preflight.md) for `--npm-cli`, `--npm-options`, and `--operation`. Live inspection cannot be combined with supplied evidence, exceptions, or a simulated `--at` clock.

The package declares the executable name `scouter-review`, but there is no need to install or link it globally. Use the direct Node invocation above.

## Schemas

Portable JSON Schema documents:

- [Evidence input](../schemas/evidence.schema.json)
- [Exception records](../schemas/exceptions.schema.json)
- [Review report](../schemas/report.schema.json)
- [Inspection report](../schemas/inspection.schema.json)
- [Live preflight report](../schemas/preflight.schema.json)
- [Live metadata review](../schemas/metadata.schema.json)
- [Supplied-proposal graph review](../schemas/graph.schema.json)
- [Error report](../schemas/error.schema.json)

[v1.mjs](../schemas/v1.mjs), [preflight.mjs](../schemas/preflight.mjs), [metadata.mjs](../schemas/metadata.mjs), and [graph.mjs](../schemas/graph.mjs) are the sources of the versioned definitions. Run `node.exe scripts/export-schemas.mjs` after editing them; tests verify that the portable documents match. All report objects reject unrecognized fields. Supplied evidence files are bounded to 4 MiB and arrays to 10,000 entries; collectors have additional documented bounds.

The built-in validator implements only the explicit vocabulary used by these schemas: types, required/allowed properties, enums, string lengths/patterns, numeric minimums, and array item/count checks. It fails on unsupported schema keywords. It is not a general-purpose JSON Schema library. If future schemas need broader semantics, review and adopt an appropriate validator rather than silently ignoring constraints.

Malformed structure is an error. Structurally valid but incomplete evidence is REVIEW. For example, omitting the `checks` property is invalid input; supplying an empty array preserves any valid findings and yields REVIEW, or BLOCK if a blocking finding exists. Unknown status enum values cannot be interpreted as success.

## Normalized evidence

Evidence contains the requested operation, project/manager context, reviewed and current input bindings, exact artifacts, graph instances, checks, and findings. The fixtures demonstrate the complete structure.

Each artifact has its own ID and registry/version/integrity identity. Instances preserve lockfile paths, direct/transitive roles, dependency type, and parent IDs. Multiple versions of the same name remain distinct. Invalid references, duplicate IDs/paths, disconnected graph instances, unsupported coordinates/origins, and a mismatched graph digest prevent PASS.

Required project checks are `context`, `graph`, `protections`, and `binding`. Each artifact also needs `identity`, `release`, `behavior`, `vulnerabilities`, and `malware`. Each category/subject pair must appear exactly once.

A check includes:

- `status`: whether collection completed, failed, or was unsupported.
- `coverage`: whether the source actually supports the required evidence category.
- `outcome`: whether the collector leaves an additional unresolved concern.
- `source`, `checkedAt`, `expiresAt`, and `details`: traceable collection evidence.

`outcome: clear` means no additional collector-level concern; it does not erase the separately normalized findings array. Advisory/malware findings are evaluated independently, so a clean-looking check cannot suppress a blocking finding.

All required categories apply to the current supported input model. Although `not_applicable` can be represented as a collection status, it cannot satisfy any of these required checks.

Timestamps must be valid UTC instants with seconds and optional exactly three fractional digits. Missing, invalid, normalized-invalid calendar dates, and future collection/publish times do not become successful evidence. Release age uses the inclusive seven-day rule; evidence expires at its one-hour TTL or the earlier supplied provider expiry. The decision's validity cannot extend past its earliest required evidence or applied exception.

The graph digest is recomputed from artifact identities and graph instances. Other project digests are compared between the supplied bindings, not recomputed from the filesystem by this evaluator. Exact input and policy digests are included in the report. These comparisons do not authenticate supplied evidence.

## Policy and exceptions

The evaluator applies [policy.md](policy.md) through [the frozen default policy](../src/policy/default.mjs). The evaluator exposes no runtime policy-file override and no flags for disabling required evidence. Arbitrary fields in evidence cannot change the default.

The required identity/behavior/provider checks are normalized collector assertions. The evaluator does not corroborate official projects, inspect archives, or authenticate providers. A manually fabricated evidence file can claim these checks completed. Consequently every report declares `mode: supplied-evidence` and `authorization: none`; even PASS is not approval to install.

To evaluate an already recorded scoped exception:

```powershell
node.exe src/cli.mjs review --evidence evidence.json --exceptions exceptions.json --format json
```

Exception records are separate from evidence. They must name an actor and authorization source, the exact artifact, operation, complete binding, rule/finding, rationale, and validity interval. The only waivable rule codes are `AGE_TOO_RECENT`, `PRERELEASE`, and `REVIEW_FINDING` with an exact finding ID. Missing evidence, compatibility/binding errors, and BLOCK findings cannot be waived.

Applied exceptions annotate reasons; raw findings are retained. Expired, mismatched, duplicate, and unused exceptions are reported. They cannot affect a different graph, package, operation, or policy. They are unauthenticated records, not authorization tokens.

## Reports and stable reason codes

Review JSON retains the full input evidence, findings, per-category coverage, original reasons, exception dispositions, input/policy digests, timestamps, expiry, and limitations. Text summarizes packages, release age, manager/protection mode, coverage, decision reasons, and exceptions. It explicitly reports unknown support status and manual protection fallback. Terminal control and bidirectional characters are escaped; JSON retains their values through escaped serialization.

| Family | Codes |
| --- | --- |
| Compatibility | `UNSUPPORTED_TOOLCHAIN`, `UNSUPPORTED_LOCKFILE`, `UNSUPPORTED_WORKSPACE`, `UNSUPPORTED_TARGET`, `MISSING_BASELINE` |
| Artifact identity | `UNSUPPORTED_ECOSYSTEM`, `UNSUPPORTED_COORDINATE`, `UNSUPPORTED_ORIGIN`, `INTEGRITY_EVIDENCE_INVALID` |
| Binding/graph | `BINDING_CHANGED`, `GRAPH_DIGEST_MISMATCH`, `POLICY_CHANGED`, `EMPTY_GRAPH`, `DUPLICATE_ID`, `GRAPH_REFERENCE_INVALID`, `GRAPH_DISCONNECTED` |
| Release policy | `PUBLISH_TIME_INVALID`, `AGE_TOO_RECENT`, `PRERELEASE`, `RELEASE_STATUS_UNKNOWN`, `RELEASE_DEPRECATED`, `RELEASE_WITHDRAWN`, `RELEASE_UNSUPPORTED` |
| Evidence | `UNKNOWN_PROTECTIONS`, `CHECK_SUBJECT_INVALID`, `DUPLICATE_CHECK`, `MISSING_EVIDENCE`, `EVIDENCE_TIME_INVALID`, `STALE_EVIDENCE`, `INCOMPLETE_EVIDENCE`, `FINDING_REFERENCE_INVALID` |
| Findings | `VERIFIED_MALWARE`, `VERIFIED_IDENTITY`, `VERIFIED_INTEGRITY`, `HIGH_CRITICAL_VULNERABILITY`, `REVIEW_FINDING` |
| Operational errors | `INVALID_INPUT`, `INTERNAL_ERROR` |

An invalid integrity string is incomplete evidence; a verified integrity mismatch is a BLOCK finding. Suspicious heuristics produce REVIEW unless the normalized evidence establishes verified compromise. This distinction prevents the reviewer from labeling every anomaly malware.

## Test and maintain

```powershell
node scripts/test.mjs
```

The suite makes no external registry/scanner requests or package installations. HTTP tests use synthetic loopback servers; the sfw adapter uses controlled runners. A graph comparison fixture runs installed npm in lockfile-only mode against synthetic metadata and checks root/advertised dependency script canaries. CLI tests retain temporary inputs/snapshots for inspection without recursive deletion. Unit tests use a fixed UTC clock; preflight tests exercise installed npm config parsing. The [npm capability harness](compatibility.md#reproduce) runs separately.

Regenerate example inputs with `node.exe tests/fixtures/generate.mjs` only when their contract changes. Changes to the policy or evidence schema require new behavioral tests, updated documentation, and reconsideration of the revision/schema version when the contract changes.

Schema migration: preflight, metadata, graph, and dependency-workflow reports use `1.1.0`. The embedded toolchain adds required `supportStatus` (`validated`, `experimental`, `unsupported`); `qualified` remains true only for validated combinations. Consumers using strict 1.0 live schemas must update. Offline evidence/review/inspection and error schemas remain unchanged.

