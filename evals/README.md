# Scouter evaluations

## Current revision

The current tight-v1 revision is an installation checkpoint: normal-tool recon, native guarded acquisition, then firewall/diff inspection and an added/changed-coordinate advisory check before execution. Mandatory manual transitive timestamps and duplicate integrity checks are retired; no bundled graph checker is planned. The [fresh-session Tailwind handoff](tailwind-repeat.md) remains pending, so this revision is not release-qualified and no v1 tag has been created.

Earlier [npm cooldown checks](npm-cooldown-checks.md) and the [routine policy walkthrough](routine-review-checks.md) describe their historical snapshots, not the current timestamp policy. Existing results remain unchanged; a previous same-session Tailwind run does not satisfy the fresh-session requirement.

The historical [Round 4 follow-up](round4/README.md) ran six targeted contexts against its own frozen revision, including a matched routine npm pair. [Results](round4/results.md) retain five passes and one corrected uv efficiency failure; shared task/safety checks passed in all six under primary-agent manual grading. Token/tool-call costs remain unavailable, not zero. No comparative safety benefit or causal savings claim is made.

[Round 4 live observations](round4/live-results.md) cover real Express/Sphinx graphs (64 and 21 transitives), pnpm/Yarn Classic installs, native absolute-cutoff rejection and uv project sync with a disclosed sequencing gap. Approved fresh installation remains pending after the user declined the newer npm tool's bundled-advisory risk. Modern Yarn is not live-qualified.

Earlier [v1 inputs](v1/README.md), [16-context results](v1/results.md), [live observations](v1/live-results.md), rubrics and cost ledgers remain unchanged. The original uv fixture inconsistency and failure remain reproducible; the corrected input is separate. The old six-criteria remediation waiver does not define the current installation-approval policy.

## Current instruction counts

Recounted 2026-10-21. [Current content record](current-skill.json): SHA-256 `e4ac11da169c8427a0b9848e38003595c7aada79db83ac4312d1c712fb051652`. Core body **873** words; including metadata **952**. Every manager guide is under 300 words. The conditional Socket guide remains **460** words and is unchanged.

| Workflow | Manager guide words | Core + entire manager guide |
| --- | ---: | ---: |
| npm | 206 | 1158 |
| pnpm | 204 | 1156 |
| Yarn Classic | 245 | 1197 |
| modern Yarn | 245 | 1197 |
| pip | 232 | 1184 |
| uv project | 236 | 1188 |
| uv requirements | 236 | 1188 |

Counts are whitespace-separated document sizes, not measured tokens or savings. The previous Test 3 snapshot (`c95a51eca65a8d8f5f7e96e6db253ced1ef041cef1b722257217be02207da6a0`) had 968 core-body words (1047 including metadata), with path totals npm 1396, pnpm 1288, Yarn 1442, pip 1382 and uv 1532; its historical results remain unchanged. Whole-file bounds include incidental Yarn/uv sections. The historical Round 4 snapshot had 918 core-body words (997 including metadata), with path totals npm 1279, pnpm 1231, Yarn 1383, pip 1311 and uv 1429. The earlier v1 snapshot had 799 core-body words (870 including metadata), with path totals npm 1120, pnpm 1104, Yarn 1250, pip 1184 and uv 1302. Its digests and results are unchanged. Earlier counts and protocols remain in [the historical guide](legacy-guide.md).

## Local validation

Run Python 3.11+ standard-library tests from the repository root:

```sh
python3 -B -m unittest discover -s evals -p 'test_*.py'
```

These tests parse fixtures, bind snapshots and validate evaluator logic. They do not invoke models, install dependencies, contact services or resume historical experiments. Model transcripts, detailed grades and live raw logs belong in ignored `.eval-results/`; only sanitized results are published. Token/tool-call/model details unavailable from the current collaboration interface remain unavailable rather than zero.

## Historical material

- [Original behavioral results](results.md) and [routine results](routine-results.md).
- [Independently graded older comparison](experiment-results.md) and [sanitized records](experiment-results.json).
- [Historical costs](cost-metrics.json) and [evaluator procedures](legacy-guide.md).
- [Frozen experiment protocol](EXPERIMENT.md) and [rubric](experiment-rubric.json).

The older comparison found shared-check passes in 50/50 Scouter responses and 48/50 baseline responses; its only difference was repeated privacy-fixture failures. That is evidence for that old snapshot, not a current effectiveness claim. Historical experiment/metrics tools remain opt-in; no model API harness, repeated trials or new campaign is part of current validation.
