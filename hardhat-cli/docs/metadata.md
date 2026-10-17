# Registry metadata and release comparison

Live review collects one public npm package's metadata and compares its requested exact release with the project's locked direct dependency. It does not install or execute packages. All live reports return **REVIEW** because graph, artifact, identity corroboration, and scanner evidence are incomplete.

## Run

From the repository's `hardhat-cli/` directory:

```powershell
node.exe src/cli.mjs review --project "C:\path\to\project" --public-package is-number --version 7.0.0 --format text
```

Use a package and version appropriate to the requested change; this example is not a recommendation to install it. JSON is the default output format. The qualified Node/npm/platform and root-lock requirements are the same as [preflight](preflight.md).

`--public-package` explicitly authorizes disclosure of that package name to `https://registry.npmjs.org/`. Do not use it for a private coordinate. The collector does not enumerate project dependencies into network requests and does not forward npm credentials, local configuration, source files, or lockfiles.

Scoped names work directly. For an existing alias such as `"friendly": "npm:@scope/real@^1"`, select both identities:

```powershell
node.exe src/cli.mjs review --project "C:\path\to\project" --dependency friendly --public-package @scope/real --version 2.0.0 --format json
```

Only the real public name is queried. The alias remains visible as the project dependency and lockfile path. The candidate version must be canonical exact SemVer; tags and ranges are not resolved. Alias declaration ranges are retained as declarations, not evaluated for candidate compatibility.

`--npm-cli` and `--npm-options` work as in preflight. Live review uses the `resolution` operation and cannot use `--operation`, `--evidence`, `--exceptions`, or the simulated CLI `--at` clock. No persistent settings are changed.

## Collection and baseline

Preflight runs before any registry request. Unsupported manager/toolchain/layout, non-public registry routing, unreadable or invalid configuration, and unresolved config coverage prevent public lookup. A missing cooldown or unsuppressed scripts remain visible concerns but do not prevent this read-only metadata request; no resolution or script execution occurs.

The baseline is the exact root `node_modules/<dependency>` lock entry, with matching root manifest/lock declarations, real identity, and public origin. Git, URL, local, linked, ambiguous, and unsupported baselines are rejected. This narrow baseline selector does not qualify arbitrary nested dependencies or the complete graph.

A new package has an explicit missing baseline. The collector does not choose a preceding release based on `latest` or a version number: historical support is unknown. For a new dependency, select and review a historical comparison separately when appropriate.

One full package metadata document provides both selected manifests and exact-version publication timestamps. Only selected versions are normalized; unrelated README content and versions are discarded. Missing, malformed, future, or invalid-calendar publication timestamps yield unknown age and `PUBLISH_TIME_INVALID`, never age zero. Accepted timestamp syntax is UTC with seconds and optional three-digit milliseconds. The seven-day boundary is inclusive.

Collected release information includes:

- Exact name/version, publication timestamp/age, prerelease channel, and deprecation message.
- Dependency, development, optional, and peer declarations; peer optionality and bundled dependencies.
- Scripts, binary entries, engines, OS/CPU/libc constraints, and `gypfile` build indication.
- Registry claims about repository, publisher, maintainers, distribution origin/integrity, signatures, attestations, and publishing Node/npm versions.

Manifest records store typed field values as canonical JSON strings. Deltas identify the field/key, added/removed/changed status, and before/after values. Empty versus absent maps have no entry-level delta. Publisher/repository and other claim changes are retained alongside manifest changes. These are descriptive changes, not malware verdicts. No transitive range is resolved, and no dependency named in a manifest is queried.

Support and withdrawal remain unknown. A missing version or HTTP 404 is not proof of withdrawal. `stable-version` means only that the exact version lacks a prerelease suffix. Repository links, signatures, and provenance objects are unverified claims, never followed or executed. Tarballs are not fetched; integrity is not verified against bytes. Published unsupported dependency sources and distribution origins generate explicit issues.

## HTTP and data boundaries

The production client uses Node's built-in HTTPS client with:

- A fixed public registry origin and a single encoded package-name path; no configurable destination, redirects, or alternate fallback registry.
- TLS certificate verification and a DNS lookup restricted to public IPv4 addresses. IPv6-only access and private-address registry mirrors are unsupported.
- No npm auth, cookies, proxy configuration, or environment-derived HTTP headers. Requests contain only fixed protocol headers and the explicit package coordinate.
- A ten-second absolute deadline per attempt, at most two attempts, and a 100 ms retry delay. Only transient network/timeouts, HTTP 429, and server errors retry. Server-provided retry delays cannot create unbounded waits.
- A 16 KiB response-header bound, 16 MiB body bound, JSON content type, UTF-8 validation, and identity encoding only. Compressed responses are rejected instead of decompressed.
- Bounded selected manifest/claim structures and values. Unknown fields are not interpreted as instructions or policy. Raw network/config diagnostics are withheld from reports.

The HTTP transport has a trusted programmatic test seam for a loopback fixture server; projects and CLI arguments cannot select it. DNS/TLS and the installed runtime remain trusted prerequisites. These controls do not constitute an OS sandbox or a universal memory bound. Very large package metadata documents return unavailable coverage rather than silently truncating results.

Root project inputs are read without writes and reread after collection to detect changes. This is not an atomic snapshot of all user/global configuration. The preflight's redacted config digest and the editable report are not protected authorization records.

## Report and exits

The [metadata schema](../schemas/metadata.schema.json) defines a separate `metadata-review-report`, `mode: live-metadata`, `decision: REVIEW`, and `authorization: none`. It includes preflight, source URL, attempt count, check/expiry times, requested identity, baseline selection, normalized releases, deltas, issues, and limitations. Expiry is one hour after collection begins; no cache is implemented.

| Collection status | Meaning |
| --- | --- |
| `complete` | Requested metadata normalized, with any missing new-package baseline explicitly recorded |
| `partial` | Selected version evidence is malformed/missing, or project inputs changed |
| `unavailable` | Registry lookup failed or returned no usable document |
| `unsupported` | Local context or baseline prevents the request |

`complete` describes collection, not complete security coverage. Release concerns can coexist with it. All four statuses exit **2**. Invalid invocation/local input or an unexpected internal error exits **4** with a separate error report. A metadata identity contradiction is invalid/untrusted evidence, not a claim of independently verified compromise. The supplied-evidence evaluator's BLOCK semantics remain unchanged.

This report is not a complete supplied-evidence document. Metadata alone cannot satisfy graph, artifact, or security-provider checks.

## Validation and coverage

The suite runs on Node 24.22.0 / npm 11.19.1, Windows x64. It exercises bounded HTTP via synthetic loopback responses, release normalization, timestamp boundaries, manifest/identity deltas, scoped aliases, private lookup prevention, inert prompt-injection text, CLI exits, no mutation, and concurrent changes. See [CLI maintenance](cli.md#test-and-maintain) for the test command.

Use [supplied-proposal graph comparison](graph-comparison.md) to compare lockfiles. Metadata review does not resolve candidate graphs, inspect archives, or scan for vulnerabilities or malware.

Primary protocol reference: [npm Public Registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md). The adapter uses the package metadata endpoint; it never follows metadata-provided links.
