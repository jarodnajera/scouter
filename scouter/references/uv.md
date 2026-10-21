# uv

Apply the core with the intended interpreter, registry routing, extras, markers, groups and workspace selection. Inspect sources before resolution; no automatically authorized local/editable/backend builds.

## Project

| Guarded add | Cooldown | Builds off |
| --- | --- | --- |
| `sfw uv --no-cache --no-python-downloads add "<pkg>==<exact>" --python <python> --no-build --no-install-project --no-install-workspace` | Append verified `--exclude-newer <UTC-cutoff>` (or `"7 days"`) | `--no-build` plus project/workspace exclusions |

- Preserve sources and native lock integrity. `--no-build` alone does not prevent every editable/project backend; stop unsupported inputs. Do not use auto-syncing `uv run` before checks.

## Requirements

| Guarded acquisition | Cooldown | Builds off |
| --- | --- | --- |
| `sfw uv --no-cache --no-python-downloads pip install --python <python> --require-hashes --no-build -r <pins.txt>` | Same verified `--exclude-newer <cutoff>` | `--no-build`, reviewed wheels only |

- Reuse complete compatible hash-bound pins. If missing, separately use guarded `uv pip compile <input> --generate-hashes --no-build --exclude-newer <cutoff> --python <python>` with the same cache/Python-download controls; never recompile supplied compatible pins.
- For both workflows, preserve selected wheel hashes and disclose reused-cache/locked-age limits. `--locked` checks lock freshness; `--frozen` does not. Exact sync may remove packages and needs authorization. Approved freshness requires a verified subcommand's `--exclude-newer-package` scoped to approved pins, original cutoff for others and no persistent relaxation; without it, stop.

Sources: [CLI](https://docs.astral.sh/uv/reference/cli/), [sync](https://docs.astral.sh/uv/concepts/projects/sync/). Scoped documentation recheck 2026-10-21; prior uv 0.13.1 help evidence is not a new live qualification.
