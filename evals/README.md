# Scouter evaluations

## Current revision

Use the [small v1 suite](v1/README.md): nine decision scenarios and seven manager variants, one run each. It tests proposed decisions with supplied fictional evidence. [Current results](v1/results.md) retain 16 completed contexts/22 turns: 15 pass and one uv-requirements efficiency failure, with a duplicate-pin fixture limitation. No independent grading or comparative safety claim is made for this revision.

[Live observations](v1/live-results.md) separately record real public evidence gathering and completed sfw-guarded npm, pip and uv requirements installations in disposable OS environments. After user tool updates, pnpm's guarded proposal remained blocked by a sandbox store-lock failure; the initial pending/unavailable states are retained. Fresh versions were not installed. This is not four-manager qualification, automatic-activation validation or proof that every artifact was scanned.

Historical cases, rubrics, comparison results and cost ledgers remain unchanged. The old six-criteria waiver does not define the current informed-approval policy. Current adaptations live separately; do not grade this revision with the old rubric.

The current skill adds a separate Socket operations reference and an explicit data-minimization section after those runs. The saved results apply to the frozen snapshot, not this documentation update; no model or live tests were rerun.

## Current instruction counts

Recounted 2026-10-19. [Current content record](current-skill.json): SHA-256 `17b1417316e2750c1efb4e2248973c48d3427704a75e2b68e5fe4c0dfeb13cdf`. Core body **887** words; including metadata **958**. Routine loading remains core plus the applicable manager guide. The Socket guide is conditional, adding **460** words for setup, uncertainty, cache adoption or restricted policy.

| Workflow | Manager guide words | Core + entire manager guide |
| --- | ---: | ---: |
| npm | 250 | 1208 |
| pnpm | 234 | 1192 |
| Yarn Classic | 380 | 1338 |
| modern Yarn | 380 | 1338 |
| pip | 314 | 1272 |
| uv project | 432 | 1390 |
| uv requirements | 432 | 1390 |

Counts are whitespace-separated words including headings, tables and metadata; whole-file bounds include incidental Yarn/uv sections. These are document sizes, not measured savings. The tested v1 snapshot had 799 core-body words (870 with metadata), with path totals npm 1120, pnpm 1104, Yarn 1250, pip 1184 and uv 1302. Its digest and results remain unchanged. Earlier counts are retained in [the historical guide](legacy-guide.md).

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
