# Hardhat Skill

Review dependencies during coding tasks, then guard eligible installs with Socket Firewall Free (`sfw`). Hardhat checks identity, release maturity, dependency and behavior changes, and security evidence. It complements a separate security audit and does not guarantee package safety.

The standalone skill includes npm, pnpm, modern Yarn, Yarn Classic, and pip guidance. Classic requires manual release-age checks; other manager protections depend on the installed version. The optional Hardhat CLI remains npm-only; the skill invokes Socket's `sfw` directly for pip and other supported managers, regardless of how Socket was installed.

## Option 1: Skill only

1. Download or install the `hardhat/` folder from this repository into your agent's supported skills directory. Keep `SKILL.md`, `LICENSE`, and the entire `references/` folder together. Consult your agent's instructions for its skill location and activation method.
2. Install Socket Firewall Free using [Socket's official instructions](https://docs.socket.dev/docs/socket-firewall-free). Its npm installation command is `npm i -g sfw`. Reuse an existing trusted installation if available.
3. Ask your agent to use Hardhat when adding dependencies to your coding project. It can review packages and invoke `sfw` directly; the Hardhat CLI is not needed.

Socket recommends clearing your package manager's cache when adopting it (for npm, `npm cache clean --force`) and using `sfw` for subsequent downloads. Cache clearing removes cached artifacts and requires fresh downloads. A fresh per-operation cache is an alternative; neither approach rescans already installed packages. Socket Free supports public registries and collects telemetry.

Some skill installers copy only `hardhat/`. That is a complete standalone installation, not an error. The skill must not assume the optional sibling CLI was copied too.

## Option 2: Skill plus optional CLI

Clone this repository or download and extract its full ZIP. Keep the complete `hardhat-cli/` folder; do not copy only `src/cli.mjs`. Install the skill as above, and tell the agent the absolute path to the downloaded repository or CLI entrypoint if it is no longer beside the installed skill.

```text
HardhatSkill/
  README.md
  hardhat/          # Standalone skill and references
  hardhat-cli/      # Optional local Node CLI
```

The CLI has validated Windows x64 support and experimental macOS arm64/x64 support. Live Mac commands require `--experimental-macos true`; actual Mac validation is pending. Both require Node **24.22.0**, npm **11.19.1**, and single-root public npm projects with a v3 `package-lock.json`. Linux, other runtime versions, workspaces, and private registries are outside its supported baseline. These restrictions do not apply to the standalone skill.

The CLI has no third-party runtime dependencies. No `npm install`, build, global link, or registry package installation is required. It is distributed as source in this repository; do not run `npm install hardhat` (that is an unrelated Ethereum development tool).

From the extracted repository root:

```powershell
node ./hardhat-cli/src/cli.mjs --help
```

From any directory, replace the example repository path with your actual path:

```powershell
node "C:\path\to\HardhatSkill\hardhat-cli\src\cli.mjs" inspect --project "C:\path\to\app" --format text
```

`inspect` reads project configuration without installing packages. Use the [optional CLI reference](hardhat/references/optional-cli.md) for dependency checks, guarded installation, discovery, and result handling. Socket must be installed for `check` to be ready and for `install` to proceed. The CLI recognizes the installed Windows npm launcher as well as a native Socket binary.

For macOS shell examples, test commands, and pending validation criteria, see the [macOS validation](hardhat-cli/docs/macos-validation.md). The opt-in changes platform eligibility only; all dependency guards remain active.

## Usage and development

Hardhat limits agent-initiated external lookups to necessary public package information and prohibits project-code, secret, and PII uploads for dependency review. This is an instruction-level guardrail, not network isolation. Socket Free has mandatory telemetry beyond package identifiers, so it cannot satisfy a strictly package-only egress policy. See the skill's [data-minimization rules](hardhat/SKILL.md#data-minimization) before use in a restricted environment.

- [Skill instructions](hardhat/SKILL.md)
- [Package-manager protections](hardhat/references/package-manager-protections.md)
- [Yarn and pnpm guarded installs](hardhat/references/yarn-pnpm.md)
- [pip guarded installs](hardhat/references/pip.md)
- [Optional CLI workflow and limits](hardhat-cli/docs/workflow.md)
- [Advanced CLI commands and tests](hardhat-cli/docs/cli.md)

The CLI is a convenience, not a mandatory gate. Missing or unsupported CLI tooling leaves the standalone workflow available, but dependency concerns must still be resolved.

## Security disclaimer

Hardhat provides dependency-review guidance and optional tooling. It does not guarantee that a package, installation, or project is secure, and it may miss malicious behavior, vulnerabilities, or prompt-injection attempts. A successful check or installation is not a security certification.

You are responsible for evaluating dependencies and maintaining security controls appropriate to your environment, including independent reviews, testing, monitoring, and incident response. Hardhat and third-party tools such as Socket complement those controls; they do not replace them.

We recommend using Hardhat alongside your preferred security audit harness or toolset for broader application security checks. Keep those audits as a separate workflow with their own scope and data-sharing permissions; using Hardhat does not authorize uploading your project to another service.

Hardhat is provided without warranties. To the extent permitted by applicable law, its authors and contributors disclaim liability for losses or damages arising from its use, including missed threats, compromised dependencies, or inadequate security controls.

## License

Hardhat is licensed under the [MIT License](LICENSE). Copies are included in the standalone skill and CLI folders for separate distribution. Third-party tools retain their own licenses and terms.
