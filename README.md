# Scouter Skill

Review dependencies during coding tasks, then guard eligible installs with Socket Firewall Free (`sfw`). Scouter checks identity, release maturity, dependency and behavior changes, and security evidence. It complements a separate security audit and does not guarantee package safety.

The standalone skill is the primary workflow. The **optional CLI** supports npm projects only and requires exactly **Node 24.22.0 and npm 11.19.1**. Windows x64 is validated; macOS arm64/x64 is experimental and requires `--experimental-macos true` for live commands; Linux is unsupported. These CLI restrictions do not apply to the standalone skill's direct workflows. See [CLI compatibility](scouter-cli/docs/compatibility.md).

Scouter also handles advisories or audit findings in installed dependencies: assess applicability, choose a mitigation or compatible fix, and verify the result. Fresh security fixes require an advisory-backed, explicitly approved cooldown exception scoped to one package and version; see [Security fixes](scouter/SKILL.md#security-fixes).

The standalone skill includes npm, pnpm, modern Yarn, Yarn Classic, pip, and uv guidance, plus first-install and staged runner/scaffolder workflows. Classic requires manual release-age checks; other manager protections depend on the installed version. Poetry has no documented guarded workflow and must not be silently migrated. The optional Scouter CLI remains npm-only; the skill invokes Socket's `sfw` directly for supported managers, regardless of how Socket was installed. Runner guidance does not imply Socket support for every runner or protection of the application's own network activity.

## Example conversations (simulated)

These fictional conversations use supplied synthetic evidence, not live registry/security results. All required manager/Socket preflight checks are complete in the READY example; no install or scan has actually run. See the [detailed report examples](scouter/references/reporting.md#fictional-examples) and [offline evaluation suite](evals/README.md).

**User:** Add `scouter-eval-skill-only@1.0.0` using Scouter.

**Agent:** The supplied evidence supports an authorized guarded installation attempt:

```text
Scouter: scouter-eval-skill-only@1.0.0 — READY
Checks: identity checked (official-doc fixture); maturity checked (16 days; cutoff 2026-10-10T17:00:00Z); deps checked (exact graph/origins/hashes); behavior checked (no hooks; scripts suppressed); advisories checked (OSV-response fixture, complete, no known findings)
Gaps: none within simulated preinstall review
Operation: not run — installation and Socket not run; resulting diff/functionality validation pending
Evidence: case 12 fixtures, reviewed 2026-10-17T17:00:00Z
```

**User:** Add `scouter-eval-age@1.1.0` exactly.

**Agent:** That version is two days old. The supplied prior version `1.0.0` is past cooldown; choosing it would change your exact-version request.

```text
Scouter: scouter-eval-age@1.1.0 — REVIEW
Checks: identity checked; maturity finding (2 days; seven-day cooldown unmet); deps incomplete (prior-release comparison pending); behavior checked (current artifact, no hooks); advisories checked (OSV-response fixture, complete, no known findings)
Gaps: requested release is too fresh; no cooldown exception approved; 1.0.0-to-1.1.0 source comparison missing
Operation: not run — installation and Socket not run; offer reviewed 1.0.0 or wait for 1.1.0 to meet policy
Evidence: case 02 fixtures, reviewed 2026-10-17T17:00:00Z
```

The [evaluation rubric](evals/rubric.md#strengths-regression-map) protects untrusted-evidence handling, decision tiers, existing authorization, firewall failure handling, honest coverage limits, data minimization, progressive reference loading, and skill-only operation. Evaluation inputs and rubrics stay outside the installable skill.

## Option 1: Skill only

1. Download or install the `scouter/` folder from this repository into your agent's supported skills directory. Keep `SKILL.md`, `LICENSE`, and the entire `references/` folder together. Consult your agent's instructions for its skill location and activation method.
2. Install Socket Firewall Free using [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free). Its npm installation command is `npm i -g sfw`. Reuse an existing trusted installation if available.
3. Ask your agent to use `$scouter` when adding dependencies to your coding project. It can review packages and invoke `sfw` directly; the Scouter CLI is not needed.

Socket recommends clearing your package manager's cache when adopting it (for npm, `npm cache clean --force`) and using `sfw` for subsequent downloads. Cache clearing removes cached artifacts and requires fresh downloads. A fresh per-operation cache is an alternative; neither approach rescans already installed packages. Socket Free supports public registries and collects telemetry.

Some skill installers copy only `scouter/`. That is a complete standalone installation, not an error. The skill must not assume the optional sibling CLI was copied too.

## Option 2: Skill plus optional CLI

Clone this repository or download and extract its full ZIP. Keep the complete `scouter-cli/` folder; do not copy only `src/cli.mjs`. Install the skill as above, and tell the agent the absolute path to the downloaded repository or CLI entrypoint if it is no longer beside the installed skill.

Here, `repository/` represents your checkout directory; its actual name may differ. The child directories are `scouter/` and `scouter-cli/`.

```text
repository/
  README.md
  scouter/          # Standalone skill and references
  scouter-cli/      # Optional local Node CLI
```

Within the [CLI compatibility baseline](scouter-cli/docs/compatibility.md), projects must use public npm, a single root with no workspaces, and a v3 `package-lock.json`. Private registries are unsupported. Follow the setup and platform-specific instructions below.

The CLI has no third-party runtime dependencies. No `npm install`, build, global link, or registry package installation is required. It is distributed as source in this repository; do not run `npm install scouter` to obtain this repository.

From the extracted repository root:

```powershell
node ./scouter-cli/src/cli.mjs --help
```

From any directory, replace the example repository path with your actual path:

```powershell
node "C:\path\to\repository\scouter-cli\src\cli.mjs" inspect --project "C:\path\to\app" --format text
```

`inspect` reads project configuration without installing packages. Use the [optional CLI reference](scouter/references/optional-cli.md) for dependency checks, guarded installation, discovery, and result handling. Socket must be installed for `check` to be ready and for `install` to proceed. The CLI recognizes the installed Windows npm launcher as well as a native Socket binary.

For macOS shell examples, test commands, and pending validation criteria, see the [macOS validation](scouter-cli/docs/macos-validation.md). The opt-in changes platform eligibility only; all dependency guards remain active.

## Usage and development

Scouter limits agent-initiated external lookups to necessary public package information and prohibits project-code, secret, and PII uploads for dependency review. This is an instruction-level guardrail, not network isolation. Socket Free has mandatory telemetry beyond package identifiers, so it cannot satisfy a strictly package-only egress policy. See the skill's [data-minimization rules](scouter/SKILL.md#data-minimization) before use in a restricted environment.

- [Skill instructions](scouter/SKILL.md)
- [Package-manager protections](scouter/references/package-manager-protections.md)
- [Security-fix procedures](scouter/references/security-fixes.md)
- [Socket setup, cache, and telemetry](scouter/references/socket-operations.md)
- [Batch review and scaled effort](scouter/references/batch-review.md)
- [Yarn and pnpm guarded installs](scouter/references/yarn-pnpm.md)
- [pip guarded installs](scouter/references/pip.md)
- [uv guarded installs](scouter/references/uv.md)
- [First install of an existing project](scouter/references/first-install.md)
- [Staged runners and scaffolders](scouter/references/one-shot-runners.md)
- [Scoped build-script exceptions](scouter/references/build-scripts.md)
- [Standalone report format](scouter/references/reporting.md)
- [Offline behavioral evaluations and results](evals/README.md)
- [Optional CLI workflow and limits](scouter-cli/docs/workflow.md)
- [Advanced CLI commands and tests](scouter-cli/docs/cli.md)

The CLI is a convenience, not a mandatory gate. Missing or unsupported CLI tooling leaves the standalone workflow available, but dependency concerns must still be resolved.

## Reference maintenance

Maintainers review upstream guidance at least every three months and before each Scouter release. Reported incompatibilities and relevant upstream breaking changes trigger an earlier review of affected guidance. This is a maintenance policy, not an automatic scheduled job; it does not replace installed-version verification during use.

Review command names/options, release-age units and operation-specific coverage, script/build controls, cache and registry behavior, Socket support/telemetry, official source links, and consistency across command examples. Resolve differences using the [shared version-discrepancy procedure](scouter/references/package-manager-protections.md#resolve-version-discrepancies), including version-matched configuration documentation when help omits a setting.

Each “documentation checked” date describes the material actually reviewed, not live platform validation or a blanket certification of all references. Update only rechecked material and record relevant tool versions, source evidence, and validation limits alongside it. Leave other dates unchanged; editorial changes alone do not reset them. The optional CLI's [compatibility matrix](scouter-cli/docs/compatibility.md) changes only after its separate qualification process.

## Security disclaimer

Scouter provides dependency-review guidance and optional tooling. It does not guarantee that a package, installation, or project is secure, and it may miss malicious behavior, vulnerabilities, or prompt-injection attempts. A successful check or installation is not a security certification.

You are responsible for evaluating dependencies and maintaining security controls appropriate to your environment, including independent reviews, testing, monitoring, and incident response. Scouter and third-party tools such as Socket complement those controls; they do not replace them.

We recommend using Scouter alongside your preferred security audit harness or toolset for broader application security checks. Keep those audits as a separate workflow with their own scope and data-sharing permissions; using Scouter does not authorize uploading your project to another service.

Scouter is provided without warranties. To the extent permitted by applicable law, its authors and contributors disclaim liability for losses or damages arising from its use, including missed threats, compromised dependencies, or inadequate security controls.

## License

Scouter is licensed under the [MIT License](LICENSE). Copies are included in the standalone skill and CLI folders for separate distribution. Third-party tools retain their own licenses and terms.
