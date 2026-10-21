# pip

Apply the core using the project's intended interpreter/venv, requirements/constraints and declaration conventions; do not override system environments or switch managers.

| Guarded add | Cooldown | Builds off |
| --- | --- | --- |
| `sfw <python> -m pip install "<pkg>==<exact>" --only-binary=:all: --no-cache-dir --report <installed.json>` | Verified `--uploaded-prior-to P7D` or original UTC cutoff | `--only-binary=:all:` |

- Append the supported cutoff: it requires index upload-time metadata. Missing native support/coverage is REVIEW; disclose and ask. Preserve registry/TLS routing, constraints, extras and markers. Local/editable/URL/source builds require separate review; never remove wheel-only restrictions or force reinstall to succeed.
- Reuse complete compatible hash-bound requirements directly with `--require-hashes -r <pins.txt>` and the same wheel/cache/cutoff controls. If the project requires pins not yet available, resolve separately through `sfw` with supported `--dry-run --ignore-installed --report <proposal.json> --only-binary=:all: --no-cache-dir` and the cutoff; preserve selected wheel hashes. When no lock exists, compare target-environment metadata before/after and inspect the install report. Reports and `pip freeze` are not hashed locks; do not recompile compatible supplied pins.
- Preserve normal manager integrity enforcement; local sources and already-satisfied packages may bypass Socket downloads. Review report/declaration changes and added/changed public advisories before execution. No documented package-scoped cooldown exception here: a fresh candidate stops, even if its freshness is accepted; never globally relax the cutoff.

Sources: [install/cutoff](https://pip.pypa.io/en/stable/cli/pip_install/), [hashes](https://pip.pypa.io/en/stable/topics/secure-installs/). Cutoff syntax rechecked 2026-10-21 in official documentation; not live qualification or proof of installed support.
