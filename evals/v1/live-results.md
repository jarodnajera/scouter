# Current v1 live observations

These are real public evidence lookups and guarded npm, pip and uv requirements operations, separate from the synthetic offline suite. The frozen skill digest matches [the input record](snapshot.json). This is not an activation test, cross-model comparison, reliability measurement or proof of firewall efficacy.

| Manager | Stable candidate | Fresh candidate | Coverage |
| --- | --- | --- | --- |
| npm | is-number@7.0.0: guarded proposal and frozen installation completed in disposable OS sandbox | npm@12.2.1: four days old, REVIEW, not installed | One completed stable installation; fresh decision only |
| pnpm | is-number@7.0.0: REVIEW; resumed 12.14.0 guarded proposal stopped on sandbox-denied store operation lock | npm@12.2.1: REVIEW, not installed | Blocked before installation; no lock or node_modules created |
| pip | six==1.17.0: READY; guarded proposal and hash-bound wheel installation completed using 26.2.1 | uv==0.13.1: approximately 5.5 days old, REVIEW, not installed | One stable installation; selected-wheel cutoff/hash/source verified |
| uv | six==1.17.0: READY; guarded hash compilation and requirements installation completed using 0.13.1 | uv==0.13.1: REVIEW, not installed | One stable requirements installation; project route not live-tested |

## Evidence gathering

Public official-project documentation corroborated [is-number](https://github.com/jonschlinkert/is-number) and the initially considered [idna](https://github.com/kjd/idna). Registry metadata supplied exact versions, publication dates, origins and integrity. Public-coordinate-only OSV batch queries completed for the selected versions; empty result slots had no pagination token. No project files or private coordinates were submitted.

The initial old Python candidate, idna==3.10, returned [GHSA-65pc-fj4g-8rjx](https://osv.dev/vulnerability/GHSA-65pc-fj4g-8rjx) and [PYSEC-2026-215](https://osv.dev/vulnerability/PYSEC-2026-215). Advisory details were fetched, the candidate was not treated as clean and it was never installed. six==1.17.0 was then checked as a separate stable test candidate; its OSV query returned a completed empty result. Its later pip and uv installations completed as described below. These observations are dated 2026-10-19 and can change.

## Actual npm operation

The trusted sfw npm launcher 2.0.6 initialized native firewall 1.15.4. A disposable OS sandbox restricted writes to its own temporary tree; the environment used empty separate npm configurations, no inherited credentials, fresh caches and script/audit suppression. Public-network access was allowed; this is not an egress or telemetry audit.

The first artifact-acquisition preflight failed because the same empty configuration path was supplied as both user and global npm configuration. It stopped before downloading. That failed attempt was retained; separate paths corrected the configuration, with the same sandbox and firewall. No unwrapped retry occurred.

is-number@7.0.0 and prior 6.0.0 were downloaded through sfw for static manifest/source comparison, never executed. The selected tarball matched registry SHA-512 integrity and SHA-1 metadata. Neither version had lifecycle hooks or runtime dependencies; inspected source changes involved local numeric checks, with no downloader or credential behavior. OSV returned no advisory findings for 7.0.0.

A guarded lock-only proposal used the original cutoff, exact pin, fresh cache, ignored scripts and disabled audit, followed by guarded npm CI in the disposable environment. The reviewed graph contained only the direct package. The installed source matched the reviewed artifact, and the lockfile remained unchanged. npm output showed the Socket protection banner and successful exits; it did not establish per-artifact clean-scan coverage. No import, build, function call or application test was run. Raw logs/workspace paths stay ignored; see [sanitized observations](live-results.json).

## Resumed tests after user tool updates

The initial pnpm/pip age gaps were left pending at the user's request; uv was initially absent. Those earlier states and the original publication are retained privately, with a sanitized initial-attempt record in the JSON. After the user installed/updated tools, explicit Homebrew paths selected pnpm 12.14.0 and uv 0.13.1. Fresh disposable Python 3.15.0 environments contained bundled pip 26.2.1; no toolchain was installed or upgraded by this test. An older pnpm earlier on PATH and the stale bare-pip launcher were avoided.

Exact public is-number@7.0.0 and six==1.17.0 OSV checks were refreshed on 2026-10-19 and completed empty without pagination tokens. [Six's official documentation](https://six.readthedocs.io/) corroborated identity. The selected wheel's PyPI origin, SHA-256 and upload time were verified against both version metadata and the JSON simple index, including the index upload-time field needed by pip's [native cutoff](https://pip.pypa.io/en/stable/cli/pip_install/#cmdoption-uploaded-prior-to). Static inspection covered wheel members, metadata and the single source file, compared with 1.16.0 downloaded through sfw. Changes concerned compatibility mappings; no new build entry point or downloader was identified. The package was never imported.

Pip's guarded dry-run proposed only six==1.17.0. Installation used the exact reviewed wheel hash, wheel-only mode, no cache and the original seven-day cutoff. Uv's guarded compilation produced the same exact version; its accepted hashes were narrowed to that reviewed compatible wheel, excluding the source archive. Guarded uv installation retained the cutoff, no-build/no-cache controls and disabled automatic Python downloads. Both installations preserved pins and produced source and metadata matching the reviewed wheel. Every acquired graph contained one direct package and zero transitives.

The first uv compile command rejected a redundant combination of `--no-build` and `--only-binary` before acquisition. Removing the redundant option retained the documented build prohibition; the corrected guarded proposal succeeded. This failure is retained, not counted as a successful initial command.

Pnpm's [strict age controls](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict) read back from the disposable configuration, with no exclusions and untrusted-lock handling. Its sfw-guarded proposal nevertheless stopped on a sandbox-denied store operation lock. It also warned that project `stateDir` was ignored; TLS/state setting readback did not establish effective coverage. No lockfile or node_modules was created, the exact fixture manifest remained unchanged, and no install, broader retry or policy relaxation followed. This is an environment/configuration failure, not evidence of malware.

All successful acquisition/install commands showed the Socket banner, but this does not prove each artifact was scanned or clean. Fresh candidate ages are retained from the initial same-day metadata review; no fresh install or native rejection test was attempted. Three stable installations completed, with pnpm blocked. No package execution, application functionality, transitive enforcement, uv project, Yarn, activation or comprehensive platform qualification is claimed.
