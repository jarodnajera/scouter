# Scouter evaluations

## Current revision

Start with the [Round 4 follow-up](round4/README.md): six targeted contexts against the current frozen revision, including a matched routine npm pair. [Results](round4/results.md) retain five passes and one corrected uv efficiency failure; shared task/safety checks passed in all six under primary-agent manual grading. Token/tool-call costs remain unavailable, not zero. No comparative safety benefit or causal savings claim is made.

[Round 4 live observations](round4/live-results.md) cover real Express/Sphinx graphs (64 and 21 transitives), pnpm/Yarn Classic installs, native absolute-cutoff rejection and uv project sync with a disclosed sequencing gap. Approved fresh installation remains pending after the user declined the newer npm tool's bundled-advisory risk. Modern Yarn is not live-qualified.

Earlier [v1 inputs](v1/README.md), [16-context results](v1/results.md), [live observations](v1/live-results.md), rubrics and cost ledgers remain unchanged. The original uv fixture inconsistency and failure remain reproducible; the corrected input is separate. The old six-criteria remediation waiver does not define the current installation-approval policy.

## Current instruction counts

Recounted 2026-10-19. [Current content record](current-skill.json): SHA-256 `d2afc72914e01d4345f35f572a10fef00159e190c676b42a2a5155f2b0ebb0a5`. Core body **918** words; including metadata **997**. Routine loading is core plus the applicable manager guide. The conditional Socket guide adds **460** words for setup, uncertainty, cache adoption or restricted policy.

| Workflow | Manager guide words | Core + entire manager guide |
| --- | ---: | ---: |
| npm | 282 | 1279 |
| pnpm | 234 | 1231 |
| Yarn Classic | 386 | 1383 |
| modern Yarn | 386 | 1383 |
| pip | 314 | 1311 |
| uv project | 432 | 1429 |
| uv requirements | 432 | 1429 |

Counts are whitespace-separated document sizes, not measured tokens or savings. Whole-file bounds include incidental Yarn/uv sections. The earlier v1 snapshot had 799 core-body words (870 including metadata), with path totals npm 1120, pnpm 1104, Yarn 1250, pip 1184 and uv 1302. Its digests and results are unchanged. Earlier counts and protocols remain in [the historical guide](legacy-guide.md).

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
