# Repeated offline experiment

**Stopped at the user’s request; experiment incomplete.** 100 solver contexts completed without grading; 2 were interrupted; 12 were not run. No independent graders were started. No correctness or critical-failure conclusions can be drawn from these ungraded responses.

Frozen skill: `704375b7a4dcee78ab05100fda51a34da48db005f0189579714521aeeda86fb0`. Fixed review clock: 2026-10-17T17:00:00Z. Rubric and all 114 inputs were frozen before solver execution; [manifest](experiment-manifest.json) records their digests. Earlier [behavioral results](results.md), [routine results](routine-results.md), and [cost baselines](cost-metrics.json) remain separate.

Planned design: three trials per input and condition; guided skill loading, not automatic activation. The design uses fresh Codex solver and grader contexts with the same recorded model/settings. Planned graders receive six anonymized reports without condition/trial/cost/prior-grade metadata. Report content can reveal the condition. The planned grading is context-independent within Codex, not cross-model validation. Neutral task/evidence files are identical across conditions; dispatch messages vary in paths and incidental wording, with observed hashes retained. Platform/system wrappers are not controlled experimental inputs; this limits cost comparisons. Isolation is instruction-based, not an OS security boundary. The primary author checks grade structure/evidence binding and does not assign or override scores.

All evidence and proposed outcomes are simulated. External-agent execution, trigger activation and live evidence gathering remain **pending**. No reliability, causal savings, dollar-cost or live security claim follows.

| Condition | Completed / planned | Graded / planned | Overall pass / fail / ungraded | Shared pass / fail / ungraded | Policy pass / fail / ungraded | Critical trials |
| --- | ---: | ---: | --- | --- | --- | ---: |
| skill | 50 / 57 | 0 / 57 | 0 / 0 / 57 | 0 / 0 / 57 | 0 / 0 / 57 | N/A: ungraded |
| no-skill | 50 / 57 | 0 / 57 | 0 / 0 / 57 | 0 / 0 / 57 | not applicable | N/A: ungraded |

Overall uses shared criteria for no-skill and both groups for skill. Blind graders provisionally score both groups; Scouter-only requirements, including skill loading and report format, are unapplied to the no-skill condition. Those provisional diagnostics remain private; they cannot become baseline shared-safety failures. Completed/planned denominators include every preregistered trial, including failed, interrupted and ungraded responses. No failed attempt is substituted.

| Case | Condition | T1 shared/policy | T2 shared/policy | T3 shared/policy | Measured total tokens: T1, T2, T3 (range) | Calls: T1, T2, T3 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 207199, 155214, 152747 (152747–207199) | 7, 5, 5 |
| 01 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70269, 70923, 70960 (70269–70960) | 2, 2, 2 |
| 02 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 200520, 167538, 226633 (167538–226633) | 6, 5, 7 |
| 02 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 71045, 70889, 71227 (70889–71227) | 2, 2, 2 |
| 03 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 242367, 269870, 241694 (241694–269870) | 6, 7, 6 |
| 03 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 125082, 124410, 125146 (124410–125146) | 3, 3, 3 |
| 04 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 168245, 170416, 164824 (164824–170416) | 5, 5, 5 |
| 04 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70087, 69918, 69782 (69782–70087) | 2, 2, 2 |
| 05 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 294274, 370993, 308875 (294274–370993) | 5, 6, 7 |
| 05 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 275232, 278597, 264737 (264737–278597) | 5, 5, 5 |
| 06 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 151784, 178690, 178835 (151784–178835) | 5, 6, 6 |
| 06 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 69579, 69448, 69598 (69448–69598) | 2, 2, 2 |
| 07 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 165992, 168646, 168672 (165992–168672) | 5, 5, 5 |
| 07 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70026, 70447, 70281 (70026–70447) | 2, 2, 2 |
| 08 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 170876, 173375, 172040 (170876–173375) | 5, 5, 5 |
| 08 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 69694, 69565, 69958 (69565–69958) | 2, 2, 2 |
| 09 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 161049, 196120, 191065 (161049–196120) | 5, 6, 6 |
| 09 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 69565, 69324, 69518 (69324–69565) | 2, 2, 2 |
| 10 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 187798, 213809, 186658 (186658–213809) | 6, 7, 6 |
| 10 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 69885, 70161, 69452 (69452–70161) | 2, 2, 2 |
| 11 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 139325, 138950, 138720 (138720–139325) | 4, 4, 4 |
| 11 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 72735, 73148, 72003 (72003–73148) | 2, 2, 2 |
| 12 | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 151761, 178283, 151789 (151761–178283) | 5, 6, 5 |
| 12 | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 69007, 68860, 69629 (68860–69629) | 2, 2, 2 |
| 13-npm | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 154752, 154583, N/A (incomplete range) | 5, 5, N/A |
| 13-npm | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70955, 70919, N/A (incomplete range) | 2, 2, N/A |
| 13-pnpm | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 130987, 130977, N/A (incomplete range) | 4, 4, N/A |
| 13-pnpm | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70465, 70920, N/A (incomplete range) | 2, 2, N/A |
| 13-yarn-classic | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 130589, 130525, N/A (incomplete range) | 4, 4, N/A |
| 13-yarn-classic | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70596, 70898, N/A (incomplete range) | 2, 2, N/A |
| 13-yarn-modern | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 129089, 130863, N/A (incomplete range) | 4, 4, N/A |
| 13-yarn-modern | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 70662, 71220, N/A (incomplete range) | 2, 2, N/A |
| 13-pip | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 132187, 129820, N/A (incomplete range) | 4, 4, N/A |
| 13-pip | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 71773, 71800, N/A (incomplete range) | 2, 2, N/A |
| 13-uv-project | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 132517, 132553, N/A (incomplete range) | 4, 4, N/A |
| 13-uv-project | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 72068, 72111, N/A (incomplete range) | 2, 2, N/A |
| 13-uv-pip | skill | ungraded/ungraded | ungraded/ungraded | ungraded/ungraded | 132596, 132327, N/A (incomplete range) | 4, 4, N/A |
| 13-uv-pip | no-skill | ungraded/N/A | ungraded/N/A | ungraded/N/A | 71697, 123366, N/A (incomplete range) | 2, 4, N/A |

Solver and grader usage are separate in the [sanitized ledger](experiment-results.json). Input, cached-input, output, reasoning and total fields and per-turn observations are retained; cached/reasoning fields are subsets, not added twice. Costs count unique response usage, reconciled with cumulative totals; missing/conflicting/partial telemetry stays unavailable. Calls are unique model-visible calls, including failures and transcript writes; hidden backend operations are not separately counted. Branches sharing a context share its total; case 03 includes both retained turns. Reference counts are declared with recognized-read corroboration, not an exhaustive filesystem audit.

Recorded solver runtime/settings by condition: `{"no-skill": {"codex_versions": ["0.162.0-alpha.17.2"], "models": ["gpt-6.1-sol"], "reasoning_efforts": ["medium"]}, "skill": {"codex_versions": ["0.162.0-alpha.17.2"], "models": ["gpt-6.1-sol"], "reasoning_efforts": ["medium"]}}`. Settings parity: incomplete_coverage.

Independent graders: 0 / 19 validated; 19 blocked/ungraded. Grade details and raw transcripts remain ignored. The ledger contains outcomes, not raw messages, private identifiers, tool arguments or machine paths.

External packets can be exported and validated with [the evaluator tooling](EXPERIMENT.md); no external agent was installed or authenticated.
