# npm cooldown feedback revision checks

Recorded October 19, 2026; updated for Test 3 feedback. Historical evaluation snapshots remain unchanged. The existing Tailwind run resumed (see the appended work log); the independent fresh-session repeat remains pending.

## Reproduce the offline checks

Use a trusted, already installed Node and npm. Pass absolute paths; no tool acquisition is needed:

```sh
/absolute/path/to/node evals/npm-cooldown-checks.cjs /absolute/path/to/npm/package.json
python3 -B -m unittest discover -s evals -p 'test_*.py'
```

The opt-in JavaScript check loads the installed npm resolver and Arborist with in-memory synthetic registry metadata, offline mode, and artifact extraction disabled. It creates and removes only its own temporary fixtures. It never reifies a tree, invokes Socket, fetches packages, or executes dependency code. Its runtime fixture executes only a small authored probe via `npm run build`; this is not the Tailwind application build. No replacement HOME or user/global npm configuration is created or edited.

## Observed results

Eight checks passed using Node 22.14.0 and npm 11.2.0:

| Check | Observation and limit |
| --- | --- |
| Fresh exact version | Installed `npm-pick-manifest` rejected a timestamped fresh candidate with ETARGET. |
| Mature direct and transitive versions | Arborist selected mature versions; the same absolute cutoff reached both manifest requests. Metadata was supplied in memory, not fetched through Socket. |
| Missing timestamps | The resolver admitted the candidate with a missing version timestamp and with the entire time map absent. Native cutoff alone is insufficient evidence for these cases. |
| Fresh locked entry | Arborist reused a fresh locked version without requesting its manifest. This demonstrates why prelocked acquisition needs prior age evidence. |
| Stricter configuration | The npm CLI read a stricter project cutoff. A weaker CLI flag overrode it; explicitly retaining the earlier date preserved it and rejected the candidate. The fixture config file was unchanged. No newer relative-age/exclusion semantics were tested. |
| Runtime identity | Explicit Node/npm paths and a PATH headed by the selected Node directory kept an authored npm build subprocess on that runtime under two inherited PATH variants. Actual sandbox-to-escalation and Socket launcher behavior remain untested in this revision. |
| Lock baseline | A copied authoritative lock remained intact when both the working lock and hidden installed-state lock changed. A hidden-lock comparison would have missed the addition. |

The first tree check failed because macOS's temporary-directory path was not canonicalized; using its real path fixed the fixture. No acquisition or retry with weaker protections occurred.

The skill validator passed using an already installed Anaconda Python with PyYAML; the default Python initially failed because PyYAML was absent. No validation dependency was installed. All 55 existing Python evaluator tests passed, including current-digest and historical-snapshot binding checks. Git whitespace checks passed.

## Policy review

These are manual instruction walkthroughs, not new model evaluations or executable policy enforcement:

| Situation | Required behavior retained in the revised instructions |
| --- | --- |
| Missing `min-release-age`, supported `before`, otherwise complete evidence | Routine exact guarded addition may proceed without a lock-only proposal or redundant Scouter question. |
| Theoretical npm timestamp gap or unverified reused locks | Use the npm-specific batched graph check before execution; no proposal or risk question solely for the theoretical limitation. Actual missing/invalid/fresh timestamps or failed checks remain REVIEW. |
| Changed origin/integrity or incomplete advisory results | REVIEW and stop execution; disclose partial acquisition if it already occurred. |
| Socket warning despite exit zero | Inspect and resolve the concern before execution; confirmed compromise is BLOCK. |
| Telemetry prohibited or assurance unavailable | Stop or disclose the unresolved policy gap; routine README disclosure does not grant policy exceptions. |
| Build requested before post-install graph checks complete | Keep execution pending; acquisition approval does not waive advisory checks or build review. |
| Harness approves a shell/network action | This does not accept Scouter REVIEW risks or override BLOCK. |

The README retains a conditional prompt-count target, not a promised count. No global tools, permissions, skill version, CLI, or APIs changed. Newer npm age/exclusion controls, live Socket coverage, agent decisions, and Tailwind browser behavior require their separate validation; the offline checks do not certify them.

## Test 3 revision validation

The eighth offline check models a four-worker batch: mature and exactly-at-cutoff timestamps pass; fresh reused locks, missing/invalid timestamps and lookup failures fail. Duplicate coordinates are collapsed, multiple versions share one package fetch, optional entries remain included, and output excludes bulky metadata. A local origin allowlist rejects private/file sources before lookup. This is a synthetic policy model, not shared production code or proof of agent behavior. The live batch separately observed 38 passing coordinates, 36 HTTP requests and two reused metadata responses in one command.

Native resolver/runtime/baseline checks remain unchanged in substance. Only npm receives the timestamp fallback. Harness permissions remain separate from risk acceptance; browser interaction remains pending because no browser connection was available.

Current validation: all eight JavaScript checks and 55 Python evaluator tests passed; the skill validator passed with the existing Anaconda Python (default Python lacks PyYAML). The resumed install added 18 packages; the manifest/lock matched the proposal and three application builds passed, including temporary second-source discovery and cleanup. Click feedback passed a minimal DOM fixture, not a real browser. See [resumed work log](../tailwind-button-work-log.md#resumed-run-after-test-3-feedback--october-19-2026) for limits and permission accounting.
