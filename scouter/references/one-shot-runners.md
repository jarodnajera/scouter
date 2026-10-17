# Staged runners and scaffolders

Read before `npx`/`npm exec`, pnpm runners, `yarn dlx`, `uvx`, `pipx run`, or a `create-*` scaffolder. These operations combine dependency acquisition and tool execution. Apply the [Ready criteria](../SKILL.md#minimum-evidence-for-ready), [manager protections](package-manager-protections.md), and [Socket assessment](socket-operations.md). Documentation checked on 2026-10-17; verify the installed manager and exact tool's official instructions. Follow the [shared version-discrepancy procedure](package-manager-protections.md#resolve-version-discrepancies) when installed capabilities differ from these examples.

## Review the actual operation

Identify the distribution, exact version, intended executable and arguments, target directory, and generated files. A command name can differ from the package name. Resolve tags/ranges to an exact reviewed version. Inspect tool configuration, templates/plugins, and any additional packages they request; include those public coordinates in the review without uploading project data.

Socket documents npm, pnpm, Yarn, pip, and uv support, not every subcommand or tool's own downloads. `pipx` is not a documented Free manager: return REVIEW rather than assuming its subprocesses are guarded. A proposed replacement using pip or uv needs an explicit scope decision; do not silently switch tools. Private/custom registries remain unsupported. [Socket support](https://docs.socket.dev/docs/socket-firewall-free).

## Prepare, inspect, then run

1. Choose a fresh task-owned preparation directory/environment using the intended manager and trusted installed tooling. Keep the application's declarations separate; do not add a scaffolder as an application dependency merely to stage it. Preserve relevant approved registry configuration and stronger policy without copying credentials into reports.
2. Complete identity/source review, then resolve the exact tool and transitive graph without tool execution using a supported manager workflow. Check graph ages, integrity, advisory results, and behavior as in [batch review](batch-review.md). No safe proposal path or incomplete evidence means REVIEW.
3. Install the reviewed graph through `sfw` with lifecycle/build suppression and fresh-cache controls. Use the manager's existing guide, or [first install](first-install.md) for a prepared lockfile. Inspect output and the installed graph before execution. Cached runner environments are not proof of a checked download; do not reuse one without valid artifact evidence.
4. Locate the prepared package's declared executable/entry point and verify it belongs to the reviewed installation. Run that exact local executable in the intended target directory under existing task authorization. Do not invoke a fetching runner again; do not rely on PATH lookup that could select an unrelated tool. For Yarn PnP, use its verified existing-install execution mechanism with executable hooks reviewed; if execution cannot be bound to the prepared graph without resolution/downloads, return REVIEW.
5. Review generated manifests, lockfiles, templates, and changes. Run any dependency installation as a separate guarded Scouter operation before building/importing generated code. Report tool/version, staged graph, execution outcome, generated changes, and gaps.

Lifecycle suppression prevents installation hooks, not the requested executable's own code. `sfw` filters supported artifact downloads; it neither confines the tool nor makes its API, template, binary, or nested-installer downloads safe. Do not wrap arbitrary application execution in `sfw` and claim a sandbox. A tool requiring unreviewed code acquisition or build execution needs separate review before it runs.

For a required suppressed JavaScript tool build, complete [build-script exception review](build-scripts.md) within the prepared environment before invoking the tool. Runner execution permission does not automatically approve its build hooks or follow-up downloads.

## Runner-specific routing

| Requested operation | Use this staged route |
| --- | --- |
| `npx` / `npm exec`, npm create/init scaffolder | Prepare the actual pinned package with npm protections, then invoke its verified local binary. npm exec can acquire missing packages; neither its prompt nor cache is a review step. [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/) |
| `pnpm dlx` / `pnx` | Check installed-version help; current docs expose `pnx` at the former dlx URL. Use pnpm add/install in the preparation directory, then the prepared binary. Do not copy runner build permissions to all dependencies. [pnpm runner](https://pnpm.io/cli/pnx) |
| Modern `yarn dlx` / Yarn create | Prepare with the matching Yarn version and reviewed graph; use the installed executable. Classic and modern commands/configuration differ. [Yarn dlx](https://yarnpkg.com/cli/dlx) |
| `uvx` / `uv tool run` | These are tool-running operations, not project sync. Stage a pinned tool in a task-owned uv environment using the [uv pip-compatible route](uv.md#pip-compatible-workflow), then invoke its installed entry point. Do not change the user's global tool environment. [uv tools](https://docs.astral.sh/uv/concepts/tools/) |
| `pipx run` | REVIEW: no verified Socket Free workflow here. Explain the gap and offer a separately reviewed staging alternative. |

For scaffolders, verify the exact tool/version's documented skip-install option or interactive choice and select it before execution. There is no universal `--skip-install` flag. If the tool cannot generate files without automatically acquiring/running unreviewed dependencies, stop and present the concrete operation, remaining risk, and alternative for a scoped user decision. That decision cannot convert unsupported coverage into a guarded-install claim or waive BLOCK findings.

Use the [standalone report format](reporting.md), identifying the exact tool/prepared graph and separating preparation, installation, tool execution, generated changes, and pending follow-up installs/builds. Never report staging alone as completed tool execution.
