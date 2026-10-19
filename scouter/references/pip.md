# pip

Use the core with the intended interpreter/venv, never an unrelated global pip or system-environment override. Preserve constraints, extras, markers and the project's declaration conventions.

| Field | pip |
| --- | --- |
| Detect | Requirements/constraints and `pyproject.toml`; follow local includes, inspect remote includes, index/find-links/TLS settings and editable/direct-URL options without exposing credentials. Do not switch Poetry/uv projects to pip. |
| Guarded acquisition | Reuse supplied complete compatible reviewed pins without repeating resolution. Otherwise resolve wheels: `sfw <python> -m pip install --dry-run --ignore-installed --report <proposal.json> --only-binary=:all: --no-cache-dir <name>==<exact>` (or `-r <reviewed-input>` with existing constraints). Bind selected wheel origins/hashes and use the hashed command below. Routine graph advisories may follow acquisition; staged review inspects the proposal first. |
| Native cooldown | Where verified, append `--uploaded-prior-to <UTC-cutoff>` to proposal and acquisition; use index upload-time metadata and selected-wheel coverage, including later uploads. Otherwise transitive age enforcement is Unsure. |
| Script/build suppression | `--only-binary=:all:`. Preflight and stop for separate review of local/editable/source/backend builds; a dry-run may otherwise execute metadata code. |
| Cache | `--no-cache-dir`; local find-links and already-satisfied packages can still bypass Socket downloads. |
| Frozen graph | Pin every resolved distribution and reviewed compatible wheel SHA-256 in `<pins.txt>`, then `sfw <python> -m pip install --require-hashes --only-binary=:all: --no-cache-dir --report <installed.json> -r <pins.txt>`. |
| Gotchas | JSON reports and `pip freeze` are not hashed locks. Bind wheel URL/origin/hash to registry evidence; inspect installed report and declaration changes. Never force reinstall, disable build isolation, or omit dependencies to make it succeed. |

pip has no documented package-scoped cutoff exception here. For an approved fresh wheel, use only the core's frozen/hash-bound fallback after establishing the original cutoff for non-exempt artifacts; do not run open resolution with a globally relaxed cutoff. If that cannot be bounded, stop. Lack of any native age feature remains a disclosed approvable gap, not a claim of native protection.

Documentation checked 2026-10-19: [install/cutoff](https://pip.pypa.io/en/stable/cli/pip_install/), [hashes](https://pip.pypa.io/en/stable/topics/secure-installs/), [reports](https://pip.pypa.io/en/stable/reference/installation-report/). Local pip 23.0.1 help confirms reports/wheels/hashes, not the newer cutoff. No live pip qualification.
