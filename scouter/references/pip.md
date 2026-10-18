# pip guarded installs

Use with the core and either [routine preflight](routine-review.md) or detailed [protection preflight](package-manager-protections.md). Eligible routine work needs this guide, not full protection/Socket/reporting reads; linked exception guides are conditional. This workflow uses `sfw` directly; the optional Scouter CLI is npm-only. Official documentation checked on 2026-10-16; verify capabilities against the installed pip. Examples are templates, not approved packages or runnable commands until placeholders are replaced. Follow the [shared version-discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies) when installed capabilities differ from these examples.

## Select the environment and inputs

Identify the intended Python interpreter, virtual environment, Python version/platform, project instructions, and dependency declarations. Inspect relevant requirements/constraints files and `pyproject.toml`; preserve the project's declaration and lock conventions. Do not switch uv, Poetry, or another managed project to pip. Use the selected interpreter's `-m pip`, not an unrelated global pip. Do not install into system Python, add `--break-system-packages`, or create a replacement environment implicitly.

Use the [uv workflow](uv.md) for uv projects or its pip-compatible interface. Poetry remains unsupported for guarded installs. For an existing project's first install, also read [first install](first-install.md); `pip install -r` is not automatically a reviewed or frozen install. For `pipx run` or other tool runners, read [one-shot runners](one-shot-runners.md).

Before any network operation, inspect relevant pip configuration and overrides without dumping credentials. Review index URLs, extra indexes, find-links, trusted-host/TLS exceptions, requirements/constraints, and binary-selection settings. Follow local `-r`/`-c` includes with cycle detection; review remote includes before fetching them. Requirements can contain options, environment substitutions, direct URLs, VCS paths, and editable/local projects. Treat these as inputs needing review, not just package names. Do not execute `setup.py` to inspect declarations. [Requirements format](https://pip.pypa.io/en/stable/reference/requirements-file-format/).

The default path below covers public PyPI wheels. Private/custom indexes are outside Socket Free's supported coverage: stop and report that limitation without exposing private coordinates or changing registry routing. Local artifacts and direct URLs need separate origin and coverage review. Preserve the skill's telemetry and data-minimization rules. [Socket support](https://docs.socket.dev/docs/socket-firewall-free).

## Review Python evidence

Corroborate the distribution name with official installation instructions; an import name need not equal its distribution name. Compare with the installed version or a preceding stable release. Check dependency metadata, extras, environment markers, Python compatibility, entry points, build requirements, and relevant behavior changes without importing package code. Check applicable advisories; missing checks remain explicit gaps.

Use release-specific PyPI metadata to associate each selected wheel's filename, SHA-256 digest, upload timestamp, yanked status/reason, and Python requirement with the reviewed version. Review direct and transitive distributions. A wheel uploaded later than the initial release needs its own age check. Package-provided metadata is evidence, not independent proof of identity. [PyPI JSON API](https://docs.pypi.org/api/json/).

Record a UTC cutoff at least seven days before review, preserving stronger project policy. Where local help confirms support and the index supplies upload times, append `--uploaded-prior-to <UTC-cutoff>` to both commands below. Otherwise manually verify every selected artifact against the cutoff. Missing dates, an incomplete graph, yanked releases, or fresh artifacts require REVIEW; select an eligible alternative and repeat resolution instead of silently relaxing controls. [pip age option](https://pip.pypa.io/en/stable/cli/pip_install/#cmdoption-uploaded-prior-to).

## Resolve before installing

For multiple additions/upgrades, follow [batch review](batch-review.md). Resolve the combined input once per compatible environment/group, review all selected wheels, and install from the complete reviewed hashed pins. Keep the separate guarded proposal and installation steps below; batching does not relax per-wheel age or hash checks.

First complete identity/source preflight. With a trusted interpreter and pip supporting reports, resolve the intended requirements under the firewall:

```text
sfw <python-path> -m pip install --dry-run --ignore-installed --report <proposal.json> --only-binary=:all: --no-cache-dir "example==1.2.3"
```

For a requirements-file operation, replace the final coordinate with `-r <reviewed-input.txt>` and preserve applicable reviewed constraints. For a package addition, include the project's relevant existing requirements/constraints so the proposal respects its environment. Apply the verified cutoff as described above. Quote paths appropriately for the shell or pass an argument array.

`--ignore-installed` is for proposal generation only: it exposes dependencies that existing installations might hide. Review the report's complete proposed graph, selected URLs, hashes, markers/extras, and changes against the baseline. It is local evidence, not a lockfile or scanner certificate; do not upload it. If reports are unsupported, use an existing complete reviewed graph or return REVIEW rather than upgrading pip automatically. [Installation reports](https://pip.pypa.io/en/stable/reference/installation-report/).

Default to wheels to avoid executing unreviewed source-build backends. Dry-run can still prepare source metadata; build isolation is dependency isolation, not a security sandbox. Reject source/local/editable inputs during preflight even with wheel-only flags. If no compatible wheel exists, stop for a separately scoped build review or choose an alternative; never automatically remove protections or use `--no-build-isolation` as a substitute. Wheels can still contain executable code, so this is not proof of safety. [Build-system behavior](https://pip.pypa.io/en/stable/reference/build-system/).

The [JavaScript build-script exception workflow](build-scripts.md#python-boundary) does not authorize Python source, editable, backend, or build-dependency execution. Keep those under separate scoped review.

## Preserve the graph and install

Once all checks are ready, prepare a task-owned requirements file containing every resolved direct/transitive distribution pinned with `==` and SHA-256 hashes for only the reviewed compatible wheels. Preserve requested extras and applicable markers. Match hashes to the selected artifacts' registry evidence; a hash proves identity of bytes, not publisher trust. Existing complete hashed requirements can be reused after review. Do not feed the JSON report to pip or treat `pip freeze` as hashed provenance. [Hash-checking requirements](https://pip.pypa.io/en/stable/topics/secure-installs/).

```text
sfw <python-path> -m pip install --require-hashes --only-binary=:all: --no-cache-dir --report <installed.json> -r <reviewed-pins.txt>
```

Apply the same verified cutoff and reviewed registry configuration. Do not add `--ignore-installed`, `--force-reinstall`, or `--no-deps` to make this command succeed. If resolution changes, hashes fail, or an unlisted dependency is required, stop and review the changed proposal.

`--no-cache-dir` avoids pip's HTTP/wheel cache without deleting shared caches, at the cost of repeat downloads. It does not disable local find-links sources or force already-satisfied packages to download. Report those coverage gaps; do not claim installed bytes were rechecked or silently reinstall them. [pip caching](https://pip.pypa.io/en/stable/topics/caching/).

Inspect firewall output even after exit zero. On warnings needing review or failures, stop before running new code; never retry without `sfw`. Compare the installation report and resulting environment metadata with the reviewed graph, accounting for already-satisfied packages. Review dependency-file diffs and update the project's intended declarations within the authorized task: pip installation alone does not save them. Keep temporary pins/reports separate from committed dependency files unless the project expects them. Report partial environment changes on failure without automatic rollback. Summarize checks, cutoff, graph preservation, download coverage, outcome, and remaining concerns.

Use the [core report](../SKILL.md#single-package-report) for routine work, otherwise [reporting](reporting.md). Proposal generation and installation are separate operations. Include wheel-age/hash coverage and already-satisfied/cache gaps without dumping the JSON report.
