# uv

Use the core and only the selected workflow. Preserve interpreter/environment, sources, extras, markers, dependency groups, workspace selection and registry routing. Inspect local/editable/VCS inputs and dynamic metadata before resolution. `--no-build` does not prevent every first-party/editable backend; stop for their separate review, never silently remove source settings.

## Project

| Field | uv project |
| --- | --- |
| Detect | `pyproject.toml`, `uv.lock`, `uv.toml`, `.python-version`, `tool.uv.sources`. |
| Guarded acquisition | `sfw uv --no-cache --no-python-downloads add <name>==<exact> --no-sync --no-build --exclude-newer <cutoff> --python <python>`; inspect the proposed lock before syncing. A scoped `lock --upgrade-package <name>==<exact>` with the same protections handles a compatible lock-only upgrade. |
| Native cooldown | `--exclude-newer <UTC-cutoff>` at least seven days old; verify source upload metadata, per-package overrides and locked-artifact coverage. Gaps mean Unsure. |
| Script/build suppression | `--no-build --no-install-project --no-install-workspace` on sync; other local/editable dependencies still need preflight. |
| Cache | `--no-cache` or a verified fresh cache; neither rescans installed bytes. |
| Frozen graph | `sfw uv --no-cache --no-python-downloads sync --locked --no-build --no-install-project --no-install-workspace --exclude-newer <cutoff> --python <python>`. Preserve selected groups/extras. |
| Gotchas | `--locked` checks freshness; `--frozen` skips that check. Neither establishes safety. Exact sync can remove extraneous packages; check authorization. Do not casually use auto-syncing `uv run` during inspection. |

## Requirements

| Field | uv requirements |
| --- | --- |
| Detect | Existing uv pip workflow, requirements/constraints and intended interpreter/venv. |
| Guarded acquisition | `sfw uv --no-cache --no-python-downloads pip compile <input> --generate-hashes --no-build --exclude-newer <cutoff> --python <python> --output-file <pins.txt>`; inspect before installation. |
| Native cooldown | Same verified `--exclude-newer` selected-artifact coverage; missing coverage means Unsure. |
| Script/build suppression | `--no-build`; wheel-only reviewed sources, no automatically authorized local/editable/project backend. |
| Cache | `--no-cache`; disclose already-satisfied/reused artifacts. |
| Frozen graph | `sfw uv --no-cache --no-python-downloads pip install --require-hashes --no-build --exclude-newer <cutoff> --python <python> -r <pins.txt>`. |
| Gotchas | Keep every dependency pinned; bind accepted hashes to compatible selected wheels. Install does not save project declarations or exact-sync removals. An intentional `pip sync` needs its removal effects reviewed. |

For either workflow, bind selected wheels to registry origins/hashes and native age evidence (or disclosed gaps). Universal locks may include other targets: identify the installed subset. Prevent automatic Python downloads. For approved freshness, verify the installed subcommand's package-scoped cutoff override (`--exclude-newer-package` or matching configuration), bind to the exact pin/graph and preserve the cutoff for all other packages; restore temporary edits. No global `--exclude-newer false` bypass.

Documentation checked 2026-10-19: [CLI](https://docs.astral.sh/uv/reference/cli/), [settings](https://docs.astral.sh/uv/reference/settings/), [sync](https://docs.astral.sh/uv/concepts/projects/sync/). uv unavailable locally; these are verified documentation templates, not installed-version or live qualification.
