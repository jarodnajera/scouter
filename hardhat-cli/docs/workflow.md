# Dependency checks and Socket Firewall Free

The [standalone skill](../../hardhat/SKILL.md) is the primary workflow and invokes `sfw` directly. This CLI is an optional helper; its runtime restrictions and setup requirements apply only when using the CLI.

The optional CLI automates a short coding-agent workflow: check a requested dependency, install through Socket Firewall Free when eligible and authorized, and stop for concrete concerns. It complements your audit tool.

## One-time setup

Use Node 24.22.0 / npm 11.19.1. Windows x64 is validated; macOS arm64/x64 are experimental and require `--experimental-macos true` on each live command. Other runtime tuples remain unsupported. See the [macOS validation](macos-validation.md).

Use a trusted npm installation of Socket Firewall Free (`npm i -g sfw`), or a native binary from [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free). On Windows, Hardhat discovers global `sfw.cmd`/`sfw.ps1` shims on PATH and invokes the corresponding installed `sfw/dist/sfw.mjs` through Node without executing the shell shim. `--sfw ABSOLUTE_PATH` accepts either shim, the JavaScript entrypoint, or a native binary outside the project. Package name/entrypoint checks validate layout, not publisher authenticity; use a trusted installation.

The installed npm launcher manages downloading/updating its Socket binary during use. Hardhat does not install the npm launcher itself. Read-only `check` discovers and hashes files without launching Socket.

Socket recommends clearing the package-manager cache once when adopting the tool (`npm cache clean --force`) and using `sfw` for subsequent downloads. This removes cached artifacts and requires future downloads. Hardhat uses a fresh per-install npm cache instead, avoiding reuse without clearing the shared cache. Do not repeatedly clear global caches automatically. Neither cache approach rescans existing `node_modules`.

Socket Free reports package activity and collects telemetry, including a machine identifier and potentially a GitHub organization name. Telemetry is always enabled in the free offering. It supports public registries. Consult the official documentation before choosing it for a sensitive environment.

The CLI does not enforce package-only egress or change that telemetry. Follow the skill's [data-minimization rules](../../hardhat/SKILL.md#data-minimization): do not upload application code, secrets, or PII for dependency review. If policy requires strictly package-only telemetry, stop before invoking Socket Free and resolve the tool/policy mismatch.

## Daily usage

From `hardhat-cli`:

```powershell
node.exe src/cli.mjs check --project "C:\path\to\app" --public-package example --version 1.2.3 --format text
node.exe src/cli.mjs install --project "C:\path\to\app" --public-package example --version 1.2.3 --format text
```

Replace the example coordinate with the intended exact public package. `--public-package` permits public npm metadata lookup. `install` also permits the normal package-manager requests and Socket's documented package telemetry for that operation, including transitives. Do not use it for private projects/coordinates. The coding agent should corroborate package identity before calling the command.

Add `--dev true` for development dependencies. Optional `--sfw ABSOLUTE_PATH` selects the installed launcher or native binary and `--npm-cli ABSOLUTE_PATH` selects the qualified existing npm entrypoint. The CLI accepts structured package arguments and does not install the Socket launcher. Socket binary updates remain managed by its launcher.

`check` is read-only: it reuses metadata/preflight and checks the existing lock graph for unsupported sources. It reports freshness, deprecation, new install behavior, and material upgrade deltas. An old release is not rejected merely for its age. Unknown support, provenance, or withdrawal status is reported explicitly. The agent's identity assessment and separate audit still matter.

An optional package's bundled dependencies need not have separate lockfile entries. When every incoming edge is optional and the package's OS/CPU constraints exclude the current machine, `check` and `install` disclose the excluded bundle without treating its contents as missing or reviewed. Bundles that can apply to the target still produce `BUNDLED_DEPENDENCIES_UNVERIFIED`; unrelated missing dependencies and required peers remain blockers. npm platform overrides and `force` mode require review and prevent installation.

`install` repeats the check itself; it does not trust a saved READY file. If eligible, it invokes the external sfw launcher or native binary with an argument array containing the trusted Node/npm paths and an exact package coordinate. npm receives script suppression, an absolute cutoff at least seven days old (or the stronger project cutoff), a public registry, TLS verification, source restrictions, exact-save, and a fresh task-owned cache. No global config or existing cache is edited. Inherited Node startup injection options and Socket environment overrides are removed for the subprocess. npm config remains subject to preflight and explicit flags.

The install modifies package.json, the lockfile, and node_modules in the actual project. It is not isolated candidate resolution and is not an OS sandbox. On failure, files may be partially modified; inspect the result rather than automatically rolling back or retrying. A five-minute launcher timeout/output bound stops the observed process; descendant termination is not an OS-level process-tree guarantee.

## Results

| State | Exit | Meaning |
| --- | --- | --- |
| `ready` | 0 | Lightweight checks permit an install attempt; no installation or scan has happened |
| `completed` | 0 | sfw/npm exited zero and the requested manifest/locked version/integrity matches the metadata claim |
| `review` | 2 | A concern, missing setup/evidence, or unverified install result prevents ordinary continuation |
| `stopped` | 2 | sfw/npm failed, could not start, timed out, or exceeded output limits; no plain-npm retry |
| Error report | 4 | Invalid arguments or unexpected failure |

Socket's nonzero exit is not automatically labeled confirmed malware: it could be a network/tool error. Conversely, zero is not treated as a structured clean scan. Firewall stdout/stderr are retained as untrusted tool output, escaped in text, so the agent can inspect warnings before executing code. Logs may contain local paths or package information; review before sharing.

There is no generic bypass for REVIEW. Choose a suitable alternative or obtain a concrete user decision and handle the exceptional operation explicitly. Known confirmed malware or serious applicable vulnerabilities still mean do not install. The CLI does not perform vulnerability lookups; use advisory sources or your audit tool for that evidence.

Socket Free can allow AI-detected warnings and unknown/unscanned packages, and can miss cache/already-installed cases. Fresh cache helps the requested download path; it does not re-scan existing node_modules or establish complete transitive coverage. Hardhat does not parse an undocumented Socket report format or fabricate malware coverage from a successful command.

## Optional diagnostics and scope

The existing `inspect`, supplied-evidence `review`, metadata review, and supplied-proposal `compare` remain available. Their stricter schemas/partial reports are separate diagnostics, not mandatory stages before every install. Graph comparison uses supplied lockfiles; the install command modifies the project.

Live report schemas are `1.1.0`, adding `toolchain.supportStatus` to embedded preflight reports. `qualified` remains false for experimental Mac execution. Without opt-in, Mac commands report `MACOS_OPT_IN_REQUIRED` before public lookup or mutation. The opt-in never overrides dependency concerns or permits Linux/other runtime versions.
