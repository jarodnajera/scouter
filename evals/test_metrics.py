"""Synthetic telemetry tests. No model calls, network access or real session logs."""

import copy
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import metrics


def usage(inputs=100, cached=40, outputs=20, reasoning=5, writes=0):
    return dict(zip(metrics.FIELDS, [inputs, cached, writes, outputs, reasoning, inputs + outputs]))


def event(kind, **fields):
    return {"type": "event_msg", "payload": {"type": kind, **fields}}


def response(response_id, turn_id, value, total):
    return {"type": "token_usage_record", "payload": {
        "response_id": response_id, "turn_id": turn_id, "usage": value,
        "thread_token_usage": total}}


def tool(call_id="call-private", name="exec", command="pwd"):
    return {"type": "response_item", "payload": {
        "type": "custom_tool_call", "name": name, "call_id": call_id,
        "input": "text(await tools.exec_command({cmd:" + json.dumps(command) + "}));"}}


class MetricsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inputs = self.root / "inputs"
        self.skill = self.inputs / "scouter"
        (self.skill / "references").mkdir(parents=True)
        (self.skill / "SKILL.md").write_text("# Synthetic skill\n")
        (self.skill / "references" / "one.md").write_text("# One\n\n## Focused section\nContent.\n")
        (self.skill / "references" / "two.md").write_text("# Two\n")
        (self.inputs / "prompt.md").write_text("Synthetic request\n")
        (self.inputs / "evidence.json").write_text("{}\n")
        self.transcript = self.root / "result.md"
        self.transcript.write_text("READY (simulated)\nActual files read:\n"
                                   "- scouter/SKILL.md\n- scouter/references/one.md — entire file\n")
        self.trace = self.root / "trace.jsonl"
        self.grade = self.root / "grade.json"
        self.grade.write_text(json.dumps({"result": "pass", "case": "01", "run": "01", "skillDigest": metrics.tree_digest(self.skill),
                                         "packetDigest": metrics.tree_digest(self.inputs),
                                         "rubricDigest": "a" * 64, "transcript": "result.md"}))
        self.manifest = {"schema_version": 1, "measured_on": "2026-10-18", "runs": [{
            "run_id": "synthetic-01", "case_id": "01", "variant": None, "selected": True,
            "telemetry": str(self.trace), "expected_thread_id": "thread-private",
            "expected_turns": 1, "grade": str(self.grade), "transcripts": [str(self.transcript)],
            "input_dir": str(self.inputs), "skill_dir": str(self.skill)}]}

    def records(self):
        value = usage()
        return [
            {"type": "session_meta", "payload": {"id": "thread-private", "cli_version": "0.100-test",
                                                   "cwd": "/private/secret", "creator_account_id": "secret-account"}},
            event("task_started", turn_id="turn-private"),
            {"type": "turn_context", "payload": {"model": "synthetic-model", "effort": "medium"}},
            tool(command="cat " + str(self.skill / "references" / "one.md")),
            response("response-private", "turn-private", value, value),
            event("token_count", info={"total_token_usage": value}),
            event("task_complete", turn_id="turn-private")]

    def write(self, records):
        self.trace.write_text("".join(json.dumps(r) + "\n" for r in records))

    def extract(self, records=None, turns=1):
        self.write(self.records() if records is None else records)
        return metrics.extract_trace(self.trace, "thread-private", turns, self.skill)

    def test_usage_subsets_are_not_added_twice(self):
        result = self.extract()
        self.assertEqual(result["tokens"]["status"], "measured")
        self.assertEqual(result["tokens"]["values"], usage())
        self.assertEqual(result["tokens"]["values"]["total_tokens"], 120)
        self.assertEqual(result["tokens"]["cross_check"], "matched")

    def test_duplicate_usage_calls_results_and_snapshots(self):
        records = self.records()
        records.insert(4, copy.deepcopy(records[3]))
        records.insert(-1, copy.deepcopy(records[5]))
        records.insert(-1, {"type": "response_item", "payload": {
            "type": "custom_tool_call_output", "call_id": "call-private", "output": "failed secret result"}})
        records.insert(-1, copy.deepcopy(records[-2]))
        result = self.extract(records)
        self.assertEqual(result["tokens"]["values"]["total_tokens"], 120)
        self.assertEqual(result["tool_calls"]["count"], 1)

    def test_late_duplicate_does_not_replace_final_cumulative_record(self):
        records = self.records()
        old = copy.deepcopy(records[4])
        value = usage(200, 80, 40, 10)
        records[-2:-1] = [response("response-next", "turn-private", usage(), value), old,
                          event("token_count", info={"total_token_usage": value})]
        result = self.extract(records)
        self.assertEqual(result["tokens"]["status"], "measured")
        self.assertEqual(result["tokens"]["values"], value)

    def test_two_turns_aggregate_without_publishing_turn_identifiers(self):
        records = self.records()
        total = usage(150, 60, 30, 7)
        records += [event("task_started", turn_id="another-private-turn"),
                    tool(call_id="call-next", command="pwd"),
                    response("another-private-response", "another-private-turn", usage(50, 20, 10, 2), total),
                    event("token_count", info={"total_token_usage": total}),
                    event("task_complete", turn_id="another-private-turn")]
        result = self.extract(records, turns=2)
        self.assertEqual(result["tokens"]["values"], total)
        self.assertEqual([r["values"]["total_tokens"] for r in result["tokens"]["turns"]], [120, 60])
        self.assertNotIn("another-private", json.dumps(result))
        self.assertEqual([r["count"] for r in result["tool_calls"]["turns"]], [1, 1])

    def test_missing_file_is_unavailable_not_zero(self):
        result = metrics.extract_trace(self.trace, "thread-private", 1, self.skill)
        self.assertEqual(result["tokens"]["status"], "unavailable")
        self.assertIsNone(result["tokens"]["values"])
        self.assertIsNone(result["tool_calls"]["count"])

    def test_empty_log_is_partial_and_has_no_token_total(self):
        result = self.extract([])
        self.assertEqual(result["tokens"]["status"], "unavailable")
        self.assertEqual(result["tool_calls"]["status"], "partial")

    def test_incomplete_turn_preserves_observed_values_as_partial(self):
        result = self.extract(self.records()[:-1])
        self.assertEqual(result["tokens"]["status"], "partial")
        self.assertEqual(result["tokens"]["values"]["total_tokens"], 120)
        self.assertEqual(result["tool_calls"]["status"], "partial")

    def test_truncated_jsonl_is_not_clean(self):
        self.write(self.records())
        with self.trace.open("a") as stream:
            stream.write('{"payload":')
        result = metrics.extract_trace(self.trace, "thread-private", 1, self.skill)
        self.assertEqual(result["tokens"]["status"], "partial")
        self.assertIn("invalid_or_truncated_jsonl", result["issues"])

    def test_conflicting_response_values_are_flagged(self):
        records = self.records()
        records.insert(-1, response("response-private", "turn-private", usage(101), usage(101)))
        self.assertEqual(self.extract(records)["tokens"]["status"], "conflicting")

    def test_cumulative_mismatch_is_not_a_complete_measurement(self):
        records = self.records()
        records[-2] = event("token_count", info={"total_token_usage": usage(101)})
        result = self.extract(records)
        self.assertEqual(result["tokens"]["cross_check"], "mismatch")
        self.assertEqual(result["tokens"]["status"], "conflicting")

    def test_missing_usage_field_stays_missing(self):
        records = self.records()
        del records[4]["payload"]["usage"]["cached_input_tokens"]
        result = self.extract(records)
        self.assertIsNone(result["tokens"]["values"]["cached_input_tokens"])
        self.assertNotEqual(result["tokens"]["status"], "measured")

    def test_invalid_subset_or_total_is_not_accepted(self):
        for key, value in [("cached_input_tokens", 101), ("reasoning_output_tokens", 21), ("total_tokens", 999)]:
            with self.subTest(key=key):
                records = self.records()
                records[4]["payload"]["usage"][key] = value
                self.assertNotEqual(self.extract(records)["tokens"]["status"], "measured")

    def test_closed_cumulative_fallback_and_missing_turn_breakdown(self):
        records = [r for r in self.records() if r["type"] != "token_usage_record"]
        result = self.extract(records)
        self.assertEqual(result["tokens"]["status"], "measured")
        self.assertEqual(result["tokens"]["method"], "final_cumulative_fallback")
        self.assertEqual(result["tokens"]["turns"], [])
        self.assertEqual(result["tokens"]["values"]["total_tokens"], 120)

    def test_unclosed_or_decreasing_fallback_is_partial(self):
        records = [r for r in self.records() if r["type"] != "token_usage_record"]
        result = self.extract(records[:-1])
        self.assertEqual(result["tokens"]["status"], "partial")
        self.assertEqual(result["tokens"]["method"], "unverified_cumulative_observation")
        records.insert(-1, event("token_count", info={"total_token_usage": usage(90, 30)}))
        self.assertEqual(self.extract(records)["tokens"]["status"], "partial")

    def test_wrong_session_is_rejected(self):
        records = self.records()
        records[0]["payload"]["id"] = "unrelated-session"
        with self.assertRaisesRegex(metrics.MetricsError, "identity_mismatch"):
            self.extract(records)

    def test_failed_function_call_counts_once(self):
        records = self.records()
        records[3] = {"type": "response_item", "payload": {
            "type": "function_call", "name": "read_file", "call_id": "failed-call",
            "arguments": json.dumps({"path": "/private/path"})}}
        records.insert(-1, {"type": "response_item", "payload": {
            "type": "function_call_output", "call_id": "failed-call", "output": {"error": "denied"}}})
        result = self.extract(records)
        self.assertEqual(result["tool_calls"]["count"], 1)
        self.assertEqual(result["tool_calls"]["by_tool"], {"read_file": 1})

    def test_conflicting_or_unidentified_calls_remain_partial(self):
        for extra in [tool(name="different"), {"type": "response_item", "payload": {
                "type": "function_call", "name": "read_file"}}]:
            records = self.records()
            records.insert(-1, extra)
            self.assertEqual(self.extract(records)["tool_calls"]["status"], "partial")

    def test_only_explicit_read_list_is_counted(self):
        text = ("Propose reading scouter/references/two.md later.\n"
                "## Files and sections actually read\n"
                "- scouter/SKILL.md\n- scouter/references/one.md — only Focused section\n")
        result = metrics.declared_references([text], self.skill)
        self.assertEqual(result["files"], ["scouter/references/one.md"])
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["declared_scopes"][0]["named_sections"], ["Focused section"])
        missing = metrics.declared_references(["May read references/two.md"], self.skill)
        self.assertIsNone(missing["count"])

    def test_reused_reference_is_not_counted_twice(self):
        texts = [self.transcript.read_text(), "Evidence reuse and actual files-read list: no files were read again.\n"
                 "- scouter/references/one.md\n"]
        result = metrics.declared_references(texts, self.skill)
        self.assertEqual(result["count"], 1)
        self.assertTrue(result["by_transcript"][1]["reuse_only"])

    def test_ambiguous_or_nested_commands_do_not_prove_reads(self):
        target = str(self.skill / "references" / "one.md")
        for command in ["echo " + target, "rg --files " + target,
                        "cat " + target + " | head", "python3 - <<'PY'\ncat " + target + "\nPY",
                        "cat $(echo " + target + ")"]:
            with self.subTest(command=command):
                self.assertEqual(metrics.recognized_reads(command, self.skill), set())
        self.assertEqual(metrics.recognized_reads("sed -n '1,3p' " + target, self.skill),
                         {"scouter/references/one.md"})

    def test_literal_js_is_decoded_not_executed(self):
        item = tool(command="cat scouter/references/one.md")["payload"]
        self.assertEqual(metrics.literal_commands(item), ["cat scouter/references/one.md"])
        item["input"] = 'throw Error("do not execute"); cmd: `dynamic ${secret}`'
        self.assertEqual(metrics.literal_commands(item), [])
        for code in ['// tools.exec_command({cmd:"cat references/one.md"})',
                     'const note = "tools.exec_command({cmd:command})";',
                     'const fake = /tools.exec_command/;',
                     '/* tools.exec_command({cmd:"cat references/one.md"}) */']:
            item["input"] = code
            self.assertEqual(metrics.literal_commands(item), [])

    def test_ledger_is_deterministic_and_sanitized(self):
        self.write(self.records())
        first = metrics.build_ledger(self.manifest)
        self.assertEqual(first, metrics.build_ledger(copy.deepcopy(self.manifest)))
        output = json.dumps(first)
        for private in [str(self.root), "thread-private", "turn-private", "response-private",
                        "call-private", "secret-account", "/private/secret", "tools.exec_command"]:
            self.assertNotIn(private, output)
        self.assertEqual(first["records"][0]["references"]["corroborated_read_requests"],
                         ["scouter/references/one.md"])

    def test_bad_artifact_bindings_and_duplicate_mappings_fail(self):
        self.write(self.records())
        duplicate = copy.deepcopy(self.manifest)
        duplicate["runs"].append(copy.deepcopy(duplicate["runs"][0]))
        with self.assertRaisesRegex(metrics.MetricsError, "duplicate_run_or_session"):
            metrics.build_ledger(duplicate)
        (self.inputs / "evidence.json").write_text('{"changed":true}\n')
        with self.assertRaisesRegex(metrics.MetricsError, "input_or_rubric"):
            metrics.build_ledger(self.manifest)

    def test_wrong_transcript_and_failing_selection_are_rejected(self):
        self.write(self.records())
        grade = json.loads(self.grade.read_text())
        grade["transcript"] = "another.md"
        self.grade.write_text(json.dumps(grade))
        with self.assertRaisesRegex(metrics.MetricsError, "transcript_grade_binding"):
            metrics.build_ledger(self.manifest)
        grade["result"] = "fail"
        self.grade.write_text(json.dumps(grade))
        with self.assertRaisesRegex(metrics.MetricsError, "invalid_selection"):
            metrics.build_ledger(self.manifest)

    def test_partial_metrics_render_as_na_and_table_has_nine_columns(self):
        self.write(self.records()[:-1])
        ledger = metrics.build_ledger(self.manifest)
        rendered = metrics.render_baselines(ledger)
        self.assertIn("N/A", rendered)
        for line in rendered.splitlines():
            if line.startswith("|"):
                self.assertEqual(len(line.split("|")) - 2, 9)

    def test_wrong_case_and_symlinked_artifacts_are_rejected(self):
        self.write(self.records())
        changed = copy.deepcopy(self.manifest)
        changed["runs"][0]["case_id"] = "02"
        with self.assertRaisesRegex(metrics.MetricsError, "case_grade_binding"):
            metrics.build_ledger(changed)
        (self.skill / "references" / "link.md").symlink_to(self.transcript)
        with self.assertRaisesRegex(metrics.MetricsError, "symlink_in_bound"):
            metrics.tree_digest(self.skill)

    def test_cli_preserves_surrounding_docs_and_reproduces_both_outputs(self):
        self.write(self.records())
        manifest = self.root / "manifest.json"
        manifest.write_text(json.dumps(self.manifest))
        output, results = self.root / "ledger.json", self.root / "results.md"
        prefix, suffix = "# Keep this section\n\n", "\n\n\n## Keep this footer\nOriginal text.\n"
        results.write_text(prefix + "<!-- cost-metrics:start -->\nold\n<!-- cost-metrics:end -->" + suffix)
        args = ["metrics.py", "--manifest", str(manifest), "--output", str(output), "--results", str(results)]
        with patch.object(sys, "argv", args), redirect_stdout(io.StringIO()):
            metrics.main()
            first = (output.read_bytes(), results.read_bytes())
            metrics.main()
        self.assertEqual(first, (output.read_bytes(), results.read_bytes()))
        self.assertTrue(results.read_text().startswith(prefix))
        self.assertTrue(results.read_text().endswith(suffix))


if __name__ == "__main__":
    unittest.main()
