<p align="center">
  <img src="scouter_transparent.png" alt="Scouter skill logo" width="192" height="192">
</p>

<h1 align="center">scouter</h1>

Scouter helps your coding agent review dependencies before installing them. It checks the package and proposed changes, then uses Socket Firewall Free (`sfw`) for authorized installation.

1. Identify the package needed for the task.
2. Review identity, release maturity, dependencies, behavior and security evidence.
3. **READY:** proceed through `sfw` when authorized. **REVIEW:** resolve concerns or ask for a scoped decision. **BLOCK:** do not install.
4. Inspect installation results before executing new code and continuing the task.

READY and guarded installation require a trusted, compatible `sfw` launcher and verified protections. Approval cannot replace missing evidence or bypass cooldown or BLOCK findings.

## Installation

**Install from this repository.** Checked on 2026-10-18: [`scouter` on npm](https://www.npmjs.com/package/scouter) and [`scouter` on PyPI](https://pypi.org/project/scouter/) are unrelated packages. Neither `npm install scouter` nor `pip install scouter` installs this project.

Socket Firewall Free is a separate required tool with mandatory telemetry. Check [setup, cache and telemetry](scouter/references/socket-operations.md) for policy compatibility before use.

1. Copy the repository's complete `scouter/` folder into your agent's supported skills directory, retaining `SKILL.md`, `LICENSE` and `references/`. Follow your agent's skill-location and activation instructions.
2. Reuse a trusted Socket installation or follow [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free) (`npm i -g sfw`).
3. Ask your agent to use `$scouter` when adding dependencies; it reviews packages and invokes `sfw` directly.

The `scouter/` folder is a complete standalone skill.

## Coverage and limits

Scouter reviews package additions, explicitly requested upgrades, first installs and staged runners. Vulnerability investigation, mitigation selection and remediation are separate work. A fresh requested security fix remains REVIEW under the normal cooldown; Scouter does not grant cooldown waivers. See [installation scope](scouter/SKILL.md#installation-scope).

Guidance covers npm, pnpm, modern Yarn, Yarn Classic, pip and uv. Classic requires manual release-age checks; other controls depend on installed versions. Poetry has no documented guarded workflow: preserve its tooling. The skill invokes `sfw` directly, regardless of its installation method. Staged runner guidance does not establish Socket coverage for every runner or the tool's own network traffic.

For one established public package in an existing single-root project, use [routine review](scouter/references/routine-review.md) and applicable manager instructions. All checks and Ready criteria remain required. Verified native controls satisfy covered checks; manual evidence fills gaps. Detailed setup, exception and reporting guides load when needed.

Native controls enforce verified restrictions; `sfw` scans supported downloads. Cached artifacts may bypass checks. Without Socket, Scouter can report findings and gaps, but cannot declare READY or attempt guarded installation. Neither tool guarantees safety.

Socket recommends clearing caches when adopting it (npm: `npm cache clean --force`); explain the removal and fresh-download effects first. A fresh per-operation cache is an alternative. Neither rescans installed packages. Socket Free supports public registries and has non-disableable telemetry.

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
Gaps: requested release is too fresh; cooldown unmet; 1.0.0-to-1.1.0 source comparison missing
Operation: not run — installation and Socket not run; offer reviewed 1.0.0 or wait for 1.1.0 to meet policy
Evidence: case 02 fixtures, reviewed 2026-10-17T17:00:00Z
```

## Evaluation

The [evaluation rubric](evals/rubric.md#strengths-regression-map) and inputs remain outside the installable skill. An [independently graded offline comparison](evals/experiment-results.md#independently-graded-comparison) found shared-check passes in **50/50 Scouter responses and 48/50 baseline responses**, with two simulated privacy-reporting failures in the baseline. Both conditions passed 29/29 eligible-task handling checks; Scouter met its own stricter policy criteria in 40/50 responses. These results describe an older snapshot with synthetic evidence, not the current skill or real-world risk reduction. External-model, activation and live-evidence testing remain pending.

See [current static instruction counts](evals/README.md#current-instruction-counts) and [historical scoped offline results](evals/routine-results.md). Document word counts are not measured token or execution savings.

## Usage and development

Scouter limits agent-initiated external lookups to necessary public package information and prohibits project-code, secret, and PII uploads for dependency review. This is an instruction-level guardrail, not network isolation. Socket Free has mandatory telemetry beyond package identifiers, so it cannot satisfy a strictly package-only egress policy. See the skill's [data-minimization rules](scouter/SKILL.md#data-minimization) before use in a restricted environment.

For enforcement beyond agent instructions, configure your environment separately:

- Use a sandbox or devcontainer with restricted network egress.
- Configure the coding agent's permissions to require approval for dependency installation.
- Use install-command interception hooks to block or request approval for covered package-management commands.

Configure and verify these controls separately. Scouter provides no network isolation; `sfw` does not sandbox application execution.

- [Skill instructions](scouter/SKILL.md)
- [Package-manager protections](scouter/references/package-manager-protections.md)
- [Shared routine review](scouter/references/routine-review.md)
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

## Reference maintenance

Maintainers review upstream guidance at least every three months and before each Scouter release. Reported incompatibilities and relevant upstream breaking changes trigger an earlier review of affected guidance. This is a maintenance policy, not an automatic scheduled job; it does not replace installed-version verification during use.

Review command names/options, release-age units and operation-specific coverage, script/build controls, cache and registry behavior, Socket support/telemetry, official source links, and consistency across command examples. Resolve differences using the [shared version-discrepancy procedure](scouter/references/package-manager-protections.md#resolve-version-discrepancies), including version-matched configuration documentation when help omits a setting.

Each “documentation checked” date describes the material actually reviewed, not live platform validation or a blanket certification of all references. Update only rechecked material and record relevant tool versions, source evidence, and validation limits alongside it. Leave other dates unchanged; editorial changes alone do not reset them.

## Security disclaimer

Scouter provides dependency-review guidance. It does not guarantee that a package, installation, or project is secure, and it may miss malicious behavior, vulnerabilities, or prompt-injection attempts. A successful check or installation is not a security certification.

You are responsible for evaluating dependencies and maintaining security controls appropriate to your environment, including independent reviews, testing, monitoring, and incident response. Scouter and third-party tools such as Socket complement those controls; they do not replace them.

We recommend using Scouter alongside your preferred security audit harness or toolset for broader application security checks. Keep those audits as a separate workflow with their own scope and data-sharing permissions; using Scouter does not authorize uploading your project to another service.

Scouter is provided without warranties. To the extent permitted by applicable law, its authors and contributors disclaim liability for losses or damages arising from its use, including missed threats, compromised dependencies, or inadequate security controls.

## License

Scouter is licensed under the [MIT License](LICENSE). A copy is included in the standalone skill folder for separate distribution. Third-party tools retain their own licenses and terms.
