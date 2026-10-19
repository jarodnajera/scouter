# Round 4 follow-up

This is a bounded follow-up to [the preserved v1 suite](../v1/README.md), not a replacement for it. The [frozen input record](snapshot.json) binds five skill contexts and one no-skill context. Read [results](results.md), [live observations](live-results.md) and [cost availability](cost-metrics.json) separately.

## Reproduction boundaries

Use a fresh context per listed input, with the same inherited model/settings and no model override. Copy only its `instructions.txt`, `prompt.md`, `evidence.json` and, for skill conditions, the exact frozen skill into a packet. Do not supply rubrics, previous reports, other cases or parent conversation history. The matched routine pair has identical task/evidence bytes; only skill availability/loading differs. Packets provide instructional separation, not a demonstrated filesystem security boundary.

Allow read-only packet inspection and a designated transcript write. All operations are proposals: no network, dependency operations, package execution, uploads, credentials or configuration changes. Retain the fresh case's first response before delivering its `approval.md` in the same context. That approval is simulation-only.

Grade against the separate [rubric](rubric.json). Shared task/safety criteria apply to both conditions; Scouter-specific requirements apply only where supplied. The author manually reviewed proposed actions and supporting quotations; no independent grading campaign ran. Retain failures and missing measurements. Corrected uv evidence is a new input: the original contradictory pins and failure remain in v1.

Before cleanup, bind the exact transcripts, grades, input/skill digests and any exposed telemetry location in an explicit manifest under ignored `.eval-results/round4/`. Use the existing [metrics tooling](../metrics.py) only on uniquely mapped local traces. Do not scan unrelated sessions to locate costs. Count unique model-visible calls, preserve token subsets and scope, and keep unavailable values null. Reference declarations without a trace remain declarations. No new model API harness or runtime dependencies are needed.

## What was not demonstrated

One run per input provides no reliability estimate. The matched cost pair alone cannot isolate before/after slimming. Its token/call measurements were unavailable here. The mature modern-Yarn case does not exercise a fresh exception. No automatic activation, cross-model validation or real-world compromise reduction was measured. No extra contexts or replacement trials were run.
