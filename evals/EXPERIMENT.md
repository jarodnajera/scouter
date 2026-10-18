# Repeated offline evaluations

The current experiment was stopped at the user’s request: 100 solver contexts completed, two were interrupted, twelve were not run, and no independent graders started. All responses remain ungraded. The procedures below describe the prepared design, not completed validation. Do not resume the model runs without a new request.

[Preregistered manifest](experiment-manifest.json) fixes 114 solver contexts: 19 inputs × three trials × two conditions. The [rubric](experiment-rubric.json) separates shared task/safety criteria from Scouter-specific compliance before execution. [Results](experiment-results.md) retain every planned trial and independent grader status. Historical results and metrics remain separate.

## Checks available from a fresh checkout

Use Python 3.11+ and the standard library:

```sh
python3 -B -m unittest discover -s evals -p 'test_*.py'
```

These tests do not invoke models or resume the experiment. The current skill has changed since the frozen experiment snapshot. Raw packets, transcripts, grades, context mappings and telemetry are private and ignored; they are not supplied by a fresh checkout. Published hashes identify those artifacts but cannot recover them.

## Procedures for retained experiment artifacts

The commands below describe the prepared workflow. They require the retained private artifacts or the exact original input snapshot. In particular, `prepare` rejects the current skill because it differs from the registered snapshot. Do not alter registration hashes or overwrite historical results to make it accept a later revision. A new experiment needs a new identity and results destinations.

No evaluator command installs dependencies, contacts services or invokes a model API. Model execution is a separate, explicitly authorized agent step.

```sh
python3 -B evals/experiment.py prepare
python3 -B evals/experiment.py validate
```

`prepare` refuses to overwrite a frozen experiment. It copies the skill, rubric, approval and neutral case inputs into ignored `.eval-results/repeated-offline-v1/`. The default experiment is already registered. Reconstruction into a fresh private directory is permitted only when all public registration digests match; it cannot reconstruct transcripts or replace retained results. A later experiment needs a new identity and new results destinations, not replacement of these results.

Execute packets with existing agent tools, in manifest order, using fresh contexts and the same model/settings for both conditions. At most three solvers run concurrently here. Use no conversation-history fork. Provide only the packet path, its permitted reads, output path and simulation constraints. Skill packets additionally receive the explicit `instructions.md` loading instruction; baseline packets have only the neutral prompt and factual evidence. Do not expose the manifest, rubric, other packets, prior outputs, CLI or repository to solvers. Isolation is enforced by instructions, not an OS sandbox. File tools are identical between conditions.

Register each context immediately, before cleanup:

```sh
python3 -B evals/experiment.py register --run 01-skill-t1 --agent /root/CONTEXT_NAME
```

Write retained responses under private `responses/<run_id>.md`. For case 03, wait for turn 1 to be saved and complete, then deliver `approval.md` as a simulated user follow-up in the same context. Save the second response separately as `<run_id>-after.md`; never replace the first. Keep all branches from the original case. Record interrupted/failed attempts without passing replacements. Three rounds alternate skill-first, baseline-first, skill-first order. This tests guided use, not automatic skill triggering.

After all six reports for an input exist:

```sh
python3 -B evals/experiment.py grader --key 01
```

Use a fresh grader context reading only `graders/01/`: neutral task, evidence, evaluator-only rubric and six anonymously labeled responses. Supply its packet digest and designated grade output path. Withhold condition, trial/order, costs, prior grades and blind mapping. Response content can reveal the condition. The grader scores both groups on every report; aggregation leaves Scouter-only criteria unapplied to no-skill reports, including loading and report format. Provisional baseline policy diagnoses stay private and never enter its shared score. One grader covers a case's six contexts including every branch and both case-03 turns. Register it with `--run 01`. For each criterion request an exact `quote` from the corresponding anonymous report, or `omission: true` with a precise section/location explaining absent behavior. These are supporting-evidence fields, not additional behavioral criteria. The author validates completeness and evidence bindings without assigning/overriding scores. Structural correction may be requested without supplying intended answers; substantive disputes require a fresh independent adjudicator, recorded separately. Invalid grades remain ungraded.

```sh
python3 -B evals/experiment.py grade --key 01
python3 -B evals/experiment.py telemetry
python3 -B evals/experiment.py publish
```

Telemetry discovery queries only explicitly registered children of the current root context in the local Codex database; raw mappings/IDs stay ignored. The existing `metrics.py` extractor supplies deduplicated response usage, cumulative reconciliation, unique model-visible calls and declared/reference-read corroboration. Schema 2 adds experiment, condition, trial, harness and solver/grader roles without changing the historical schema-1 ledger. Baseline `skill_digest: null` with `skill_availability: intentionally_absent` is deliberate, not a missing artifact. Unsupported/missing telemetry stays unavailable. No branch-specific costs are invented. Case 03 aggregates both turns while preserving per-turn observations. Grader costs stay separate. Interrupted logs never become complete costs; complete logs can still have failed behavioral grades.

Publication validates the frozen packets before writing sanitized records. Per-trial results, completed/planned denominators and three-trial cost observations/ranges are descriptive; there are no cost gates, reliability or causal savings claims. The author must inspect artifact sanitization before publication. Do not publish transcripts, logs, private mappings, IDs, absolute paths or tool arguments.

## Portable external packets

```sh
python3 -B evals/experiment.py export --path .eval-results/external-export-v1
```

This exports portable packets, manifest, separate follow-up and [external-results contract](external-results.schema.json). Keep each solver isolated from the containing export, other packets, manifest and follow-up until due. No external agent is installed or authenticated here. External-harness execution, trigger activation and live evidence gathering remain pending.

Return a JSON object matching the contract with transcript-relative filenames and SHA-256 hashes. Import checks identities, snapshot/rubric/packet hashes, runtime labels, relative-path containment and turn counts. Unsupported telemetry must be explicitly unavailable; arbitrary external counters are not silently trusted. Approved-turn ordering must be attested and independently checked before grading. Imports remain private/ungraded and separate from Codex summaries until independently graded.

```sh
python3 -B evals/experiment.py import --path .eval-results/external-return/results.json
```

This is context-independent grading within Codex, not cross-model or cross-harness validation. Repeatability requires retaining packets, context mappings and telemetry before cleanup; the committed manifest/digests cannot reconstruct deleted transcripts or logs.
