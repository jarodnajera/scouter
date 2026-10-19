# Round 4 live observations

These are primary-agent operations in disposable macOS environments, separate from synthetic model evaluations. [Sanitized records](live-results.json) identify the exact frozen skill, runtime, cutoff and per-scenario limits. Earlier [v1 observations](../v1/live-results.md) remain unchanged. Package code was not imported, run as an application, built or functionality-tested; reviewed manager/tool executables ran.

| Scenario | Result |
| --- | --- |
| New npm tool | npm 11.21.0 artifact reviewed; 144 bundled coordinates checked. Advisory findings in five coordinates; user declined isolated use. Tool not installed or executed. |
| Native fresh rejection | Existing npm 11.2.0 refused react@19.3.1 with an explicit `--before` date error; no lock or installation. This does not validate `--min-release-age`. |
| Approved fresh installation | PENDING. Exact React risk approval was received, but no approved compatible scoped-exclusion tool is available. React remains uninstalled and REVIEW. |
| JavaScript dependency tree | Express 5.3.0: guarded proposal and npm CI completed; 65 instances, 64 transitives; reviewed lock preserved. |
| Python dependency tree | Sphinx 9.1.0: guarded resolution, wheel review and uv requirements install completed; 22 distributions, 21 transitives; narrowed wheel hashes preserved. |
| pnpm | Stable is-number 7.0.0 proposal and frozen install completed using a private runtime directory. |
| Yarn Classic | Stable is-number 7.0.0 install and frozen verification completed; cached verification reported already up-to-date. |
| uv project | six 1.17.0 locked sync completed without project installation; later file/hash checks passed. A harness sequencing gap prevents claiming a clean procedure. |
| Modern Yarn live | PENDING. Only Classic is installed; no bootstrap or migration was performed. |

## Fresh candidate and tool boundary

Official [React documentation](https://react.dev/versions) corroborated identity. The selected stable react@19.3.1 was approximately five days old. Its registry integrity matched, it had no runtime dependencies or install hooks, the preceding 19.3.0 artifact comparison showed only version strings changing, and the exact-version OSV lookup completed empty. The user approved only its exact public-registry disposable installation with scripts suppressed and no execution. These checks are not a safety guarantee.

The installed npm copies lacked the scoped age options. A mature compatible npm 11.21.0 tarball contained both definitions described in [npm's configuration documentation](https://docs.npmjs.com/cli/v11/using-npm/config/). Its bundled graph exposed 12 advisory IDs across brace-expansion 5.0.9, http-cache-semantics 4.2.0, ip-address 10.5.0, postcss-selector-parser 7.1.4 and undici 6.28.0. Details were fetched; full non-applicability was not established. The initial approval question incorrectly counted 13 IDs; reconciliation found 12 across the same five coordinates. The user left tool use pending, and that decision remains in force. No tool installation, execution or global configuration change followed; React approval did not override that separate decision.

Using the existing trusted npm, an `sfw`-guarded lock-only proposal with the original absolute cutoff returned an age-specific ETARGET error for React. This validates rejection by `--before` in that operation only. The newer exclusion, admission of the approved fresh candidate, rejection of other versions matching the name, and configuration restoration after an actual exception remain untested.

## Real graph checks

Public [Express](https://expressjs.com/en/starter/installing/) and [Sphinx](https://www.sphinx-doc.org/en/master/usage/installation.html) documentation corroborated intended packages. Public-coordinate-only OSV checks completed for all 65 Express coordinates and all 22 Sphinx coordinates with empty results. Neither response required pagination; no transitive finding or pagination exercise was manufactured.

Express 5.3.0 was compared with 5.2.1. Relevant changes included dependency constraints, request/response handling, content headers and filenames; no install hooks or new acquisition behavior were identified. Every resolved instance had a public registry origin and matching integrity; relevant manifest hook fields were checked. Guarded npm CI retained scripts/audit suppression, a fresh cache and the original cutoff. The lock remained unchanged, installed versions matched it and the direct package's files matched the reviewed tarball.

Sphinx 9.1.0 was compared with 9.0.4 using targeted static source and metadata checks. Entry points were unchanged; Python/docutils minimums changed. Its 22 selected wheels were bound to public origins, registry SHA-256 values and pre-cutoff upload dates, including native wheels. Source builds and automatic Python downloads stayed disabled. Accepted hashes were narrowed from universal compilation output to the selected reviewed wheels. Installation preserved those pins; wheel file bytes matched afterward, excluding installer-rewritten RECORD metadata. This is not an exhaustive code or binary audit.

The older sphinxcontrib-jsmath dependency includes an executable namespace `.pth`. Its contents were statically reviewed as namespace setup. No later Python startup in that environment occurred; all verification read files from outside it. Script/build controls do not generally suppress `.pth` execution on future interpreter startup. No documentation builds or console entry points were run.

Native cutoffs were used during resolution and installation, but no fresh transitive was injected to test rejection. No claim is made that existing npm 11.2.0 independently revalidates every locked age; the exact graph was reviewed after cutoff-filtered resolution and its locked installation was preserved.

## Other managers and harness limits

Pnpm's upstream [store-lock issue and fix](https://github.com/pnpm/pnpm/issues/16390) identified private `XDG_RUNTIME_DIR` support. A task-owned mode-0700 directory fixed the earlier sandbox error without widening the sandbox. Strict age/missing-time policies, empty exclusions, untrusted-lock handling, fresh store, integrity verification and script/hook suppression remained in place. The installed source matched the previously reviewed artifact. Its output reported a cached supply-chain verification from the proposal; no claim of a wholly new verification was made.

Yarn Classic retained an exact pin, ignored scripts and a fresh task cache. Its installed source matched the reviewed artifact and frozen verification preserved the lock. Classic has no native transitive cooldown; this graph contained no transitives, and direct age was independently known. Its second, cached operation is not a new download scan.

Uv's project path produced a matching lock and synced only six, with project/workspace installation and builds disabled. A pre-sync assertion wrongly rejected a trailing slash in the canonical PyPI URL; sync was launched before that exception was examined. Later normalized origin/hash checks and installed source checks passed. This ordering mistake is retained as a harness limitation, and the scenario stays REVIEW rather than a clean validation claim. An index-persistence warning was reviewed; the same explicit public index was supplied at both stages.

An internal comparison helper initially failed to parse before acquisition. Static-inspection checks also needed to account for the reviewed namespace `.pth` and normal RECORD rewriting. These diagnostics are retained privately. No failure caused an unwrapped retry, weaker package protections or deletion of unrelated files.

All guarded acquisition/install commands showed the Socket banner. Banners and successful exits do not prove every artifact was scanned or clean. Filesystem writes were sandbox-limited and inherited credentials minimized; public networking was allowed. This was not a network/telemetry audit, complete credential isolation, activation test or platform certification.
