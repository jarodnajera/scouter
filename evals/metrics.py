#!/usr/bin/env python3
"""Extract offline evaluation costs from explicitly mapped local Codex JSONL logs.

No logged commands are executed. Raw paths, thread/turn/response/call identifiers,
messages and arguments never enter the public ledger. See README.md for limits.
"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import shlex


FIELDS = ("input_tokens", "cached_input_tokens", "cache_write_input_tokens",
          "output_tokens", "reasoning_output_tokens", "total_tokens")
HEX = re.compile(r"^[0-9a-f]{64}$")
SAFE_LABEL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$")
READ_HEADER = re.compile(
    r"^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Actual (?:files|inputs|reads)|"
    r"Files(?:/sections| and sections)?(?: actually)? read|Evidence actually read|"
    r"Evidence reuse and actual files-read list)", re.I | re.M)
REF = re.compile(r"(?:scouter/)?references/([A-Za-z0-9_.-]+\.md)")


class MetricsError(ValueError):
    """A mapping or artifact binding cannot safely be accepted."""


def tree_digest(folder):
    digest = hashlib.sha256()
    for path in sorted(Path(folder).rglob("*")):
        if path.is_symlink():
            raise MetricsError("symlink_in_bound_artifacts")
        if path.is_file():
            digest.update(path.relative_to(folder).as_posix().encode() + b"\0"
                          + path.read_bytes() + b"\0")
    return digest.hexdigest()


def label(value):
    """Only short metadata labels, never arbitrary logged text or paths."""
    if (isinstance(value, str) and SAFE_LABEL.fullmatch(value)
            and not re.match(r"^(?:sk-|gh[pousr]_|github_pat_|AKIA)", value)):
        return value
    return None


def usage_values(value):
    if not isinstance(value, dict):
        return None
    return {key: value.get(key) if type(value.get(key)) is int
            and value[key] >= 0 else None for key in FIELDS}


def usage_valid(value):
    return (value is not None and all(v is not None for v in value.values())
            and value["total_tokens"] == value["input_tokens"] + value["output_tokens"]
            and value["cached_input_tokens"] <= value["input_tokens"]
            and value["cache_write_input_tokens"] <= value["input_tokens"]
            and value["reasoning_output_tokens"] <= value["output_tokens"])


def add_usage(values):
    return {key: sum(v[key] for v in values) if values
            and all(v.get(key) is not None for v in values) else None for key in FIELDS}


def reference_path(value, skill_dir):
    """Accept only a known skill-relative name or an absolute path in this copy."""
    skill_dir = Path(skill_dir).resolve()
    if Path(value).is_absolute():
        try:
            value = "scouter/" + Path(value).resolve().relative_to(skill_dir).as_posix()
        except ValueError:
            return None
    match = re.fullmatch(r"(?:scouter/)?references/([A-Za-z0-9_.-]+\.md)", value)
    if match and (skill_dir / "references" / match[1]).is_file():
        return "scouter/references/" + match[1]
    return None


def declared_references(texts, skill_dir):
    files = set()
    declarations = []
    scopes = []
    complete = True
    for index, text in enumerate(texts, 1):
        headers = list(READ_HEADER.finditer(text))
        if not headers:
            complete = False
            declarations.append({"transcript": index, "status": "unavailable"})
            continue
        # The explicit final read-list, not links in proposed actions/examples.
        block = text[headers[-1].start():]
        declared = set()
        for match in REF.finditer(block):
            path = reference_path("references/" + match[1], skill_dir)
            if path:
                declared.add(path)
                end = block.find("\n", match.end())
                description = block[match.end():end if end >= 0 else len(block)]
                extent = ("whole_file" if re.search(r"\b(?:entire|complete|full) (?:file|reference|guide)\b", description, re.I)
                          else "selected_sections" if re.search(r"\bonly\b|section", description, re.I)
                          else "unspecified")
                guide = (Path(skill_dir) / "references" / match[1]).read_text()
                headings = re.findall(r"^#{1,6}\s+(.+?)\s*$", guide, re.M)
                sections = [heading for heading in headings if heading.casefold() in description.casefold()]
                scopes.append({"transcript": index, "path": path, "extent": extent,
                               "named_sections": sections})
        files.update(declared)
        declarations.append({"transcript": index, "status": "declared",
                             "reuse_only": "no files were read again" in block.casefold(),
                             "files": sorted(declared)})
    return {"status": "declared" if complete else "partial",
            "count": len(files) if complete else None, "files": sorted(files),
            "by_transcript": declarations, "declared_scopes": scopes}


def literal_commands(item):
    """Recognize literal exec commands without evaluating JS or shell syntax."""
    if item.get("type") == "function_call" and item.get("name") == "exec_command":
        try:
            args = json.loads(item.get("arguments", "{}"))
        except (TypeError, json.JSONDecodeError):
            return []
        return [args["cmd"]] if isinstance(args, dict) and isinstance(args.get("cmd"), str) else []
    if item.get("type") != "custom_tool_call" or item.get("name") != "exec":
        return []
    code = item.get("input", "")
    if not isinstance(code, str):
        return []
    # Mask comments and strings before looking for a literal tool invocation.
    # This deliberately rejects regex literals / division and does not attempt
    # to interpret JavaScript. Unknown syntax receives no read corroboration.
    masked, strings, index = list(code), {}, 0
    while index < len(code):
        start = index
        if code.startswith("//", index):
            end = code.find("\n", index)
            index = len(code) if end < 0 else end
        elif code.startswith("/*", index):
            end = code.find("*/", index + 2)
            if end < 0:
                return []
            index = end + 2
        elif code[index] in "\"'`":
            quote = code[index]
            index += 1
            while index < len(code):
                if code[index] == "\\":
                    index += 2
                elif code[index] == quote:
                    index += 1
                    break
                else:
                    index += 1
            else:
                return []
            if quote == '"':
                try:
                    strings[start] = json.loads(code[start:index])
                except json.JSONDecodeError:
                    pass
        elif code[index] == "/":
            return []
        else:
            index += 1
            continue
        masked[start:index] = " " * (index - start)
    masked_code = "".join(masked)
    commands = []
    pattern = r"\btools\.exec_command\s*\(\s*\{[^{}]*?\bcmd\s*:\s*"
    for match in re.finditer(pattern, masked_code):
        # \s* crosses the masked literal: locate the original next token.
        colon = masked_code.rfind(":", match.start(), match.end())
        start = colon + 1
        while start < len(code) and code[start].isspace():
            start += 1
        if isinstance(strings.get(start), str):
            commands.append(strings[start])
    return commands


def recognized_reads(command, skill_dir):
    """Corroborate only simple literal read requests, not executed filesystem IO.

    Scripts, heredocs, substitutions, pipes, redirects and compound shell syntax
    deliberately receive no corroboration. A request does not prove full output
    delivery (for example, tools may truncate it).
    """
    if re.search(r"[;|&<>`]|\$|\b(?:for|while|if|python\w*)\b", command):
        return set()
    reads = set()
    for line in command.splitlines():
        try:
            words = shlex.split(line)
        except ValueError:
            return set()
        if not words:
            continue
        if words[0] == "cat":
            candidates = [w for w in words[1:] if not w.startswith("-")]
        elif words[0] == "sed" and len(words) >= 4 and words[1] == "-n" and re.fullmatch(r"\d+(?:,\d+)?p", words[2]):
            candidates = words[3:]
        elif words[0] in ("head", "tail") and len(words) >= 4 and words[1] == "-n" and words[2].isdigit():
            candidates = words[3:]
        elif words[0] in ("pwd", "ls", "rg"):
            continue  # File names or indexes do not establish a content read.
        else:
            return set()
        for value in candidates:
            path = reference_path(value, skill_dir)
            if path:
                reads.add(path)
    return reads


def extract_trace(path, expected_thread_id, expected_turns, skill_dir):
    responses, calls, started, finished, turn_order = {}, {}, set(), set(), []
    cumulative, snapshot, models, efforts, cli_versions = None, None, set(), set(), set()
    snapshots = []
    reads = set()
    issues = set()
    identity_verified = False
    metadata_seen = False
    response_records = 0
    unresolved_read_calls = 0
    active_turn = None
    try:
        stream = Path(path).open()
    except OSError:
        return {"tokens": {"status": "unavailable", "method": None, "values": None,
                           "turns": [], "cross_check": "unavailable"},
                "tool_calls": {"status": "unavailable", "count": None, "by_tool": {}},
                "runtime": {}, "corroborated_read_requests": [],
                "unresolved_read_call_count": None, "issues": ["telemetry_unavailable"]}
    with stream:
        for line in stream:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                issues.add("invalid_or_truncated_jsonl")
                continue
            if not isinstance(record, dict):
                issues.add("invalid_record")
                continue
            payload = record.get("payload", {})
            if not isinstance(payload, dict):
                issues.add("invalid_payload")
                continue
            kind = payload.get("type")
            if record.get("type") == "session_meta":
                metadata_seen = True
                if payload.get("id") != expected_thread_id:
                    raise MetricsError("telemetry_identity_mismatch")
                identity_verified = True
                if label(payload.get("cli_version")):
                    cli_versions.add(payload["cli_version"])
            if record.get("type") == "turn_context":
                if label(payload.get("model")):
                    models.add(payload["model"])
                if label(payload.get("effort")):
                    efforts.add(payload["effort"])
            if record.get("type") == "event_msg" and kind in ("task_started", "task_complete"):
                turn = payload.get("turn_id")
                if not isinstance(turn, str) or not turn:
                    issues.add("missing_turn_identifier")
                    continue
                (started if kind == "task_started" else finished).add(turn)
                active_turn = turn if kind == "task_started" else None
                if turn not in turn_order:
                    turn_order.append(turn)
            if record.get("type") == "token_usage_record":
                response_records += 1
                response, turn = payload.get("response_id"), payload.get("turn_id")
                value = usage_values(payload.get("usage"))
                if not response or not turn or value is None:
                    issues.add("incomplete_usage_record")
                    continue
                entry = (turn, value)
                if response in responses:
                    if responses[response] != entry:
                        issues.add("conflicting_response_usage")
                else:
                    responses[response] = entry
                    cumulative = usage_values(payload.get("thread_token_usage"))
                if turn not in turn_order:
                    turn_order.append(turn)
                if not usage_valid(value):
                    issues.add("invalid_or_missing_usage_fields")
            if record.get("type") == "event_msg" and kind == "token_count":
                info = payload.get("info") or {}
                if isinstance(info, dict) and info.get("total_token_usage") is not None:
                    snapshot = usage_values(info["total_token_usage"])
                    if snapshot is not None:
                        snapshots.append(snapshot)
            if record.get("type") == "response_item" and kind in ("function_call", "custom_tool_call"):
                call = payload.get("call_id")
                if not isinstance(call, str) or not call:
                    issues.add("missing_call_identifier")
                    continue
                signature = json.dumps({k: payload.get(k) for k in ("type", "name", "arguments", "input")}, sort_keys=True)
                name = label(payload.get("name")) or "unidentified_tool"
                if call in calls:
                    if calls[call][1] != signature:
                        issues.add("conflicting_call_record")
                    continue
                calls[call] = (name, signature, active_turn)
                commands = literal_commands(payload)
                for command in commands:
                    found = recognized_reads(command, skill_dir)
                    reads.update(found)
                    if not found:
                        unresolved_read_calls += 1

    if not metadata_seen or not identity_verified:
        issues.add("session_scope_unverified")
    closed = (identity_verified and len(started) == expected_turns and started == finished
              and len(turn_order) == expected_turns)
    if not closed:
        issues.add("incomplete_turn_scope")
    method, values, turns, cross_check = None, None, [], "unavailable"
    if responses:
        method = "unique_response_usage"
        values = add_usage([value for _, value in responses.values()])
        for index, turn in enumerate(turn_order, 1):
            items = [value for response_turn, value in responses.values() if response_turn == turn]
            turns.append({"turn": index, "values": add_usage(items), "responses": len(items)})
        checks = [v for v in (cumulative, snapshot) if v is not None]
        if checks:
            if all(values == check and usage_valid(check) for check in checks):
                cross_check = "matched"
            else:
                cross_check = "mismatch"
                issues.add("cumulative_usage_mismatch")
        else:
            issues.add("cumulative_cross_check_unavailable")
    elif not response_records and snapshot is not None:
        # Missing per-response records can fall back to a closed session total.
        method, values = "final_cumulative_fallback", snapshot
        monotonic = all(all(a[k] is not None and b[k] is not None and a[k] <= b[k]
                            for k in FIELDS) for a, b in zip(snapshots, snapshots[1:]))
        if not closed or not usage_valid(snapshot) or not monotonic:
            method = "unverified_cumulative_observation"
            issues.add("cumulative_fallback_scope_or_values_incomplete")
        else:
            cross_check = "closed_session_fallback"
        # Never allocate a context total among turns without turn evidence.
    else:
        issues.add("token_usage_unavailable")
    conflicting = bool(issues & {"conflicting_response_usage", "cumulative_usage_mismatch"})
    token_issues = issues - {"missing_call_identifier", "conflicting_call_record"}
    token_status = ("unavailable" if values is None else "conflicting" if conflicting
                    else "partial" if token_issues else "measured")
    tool_issues = issues & {"invalid_or_truncated_jsonl", "invalid_record", "invalid_payload",
                           "session_scope_unverified", "incomplete_turn_scope",
                           "missing_call_identifier", "conflicting_call_record"}
    turn_calls = []
    if closed and all(value[2] in turn_order for value in calls.values()):
        for index, turn in enumerate(turn_order, 1):
            names = [value[0] for value in calls.values() if value[2] == turn]
            turn_calls.append({"turn": index, "count": len(names),
                               "by_tool": dict(sorted(Counter(names).items()))})
    return {"tokens": {"status": token_status, "method": method, "values": values,
                       "turns": turns, "cross_check": cross_check},
            "tool_calls": {"status": "partial" if tool_issues else "measured",
                           "count": len(calls), "by_tool": dict(sorted(Counter(v[0] for v in calls.values()).items())),
                           "turns_status": "measured" if turn_calls else "unavailable",
                           "turns": turn_calls},
            "runtime": {"models": sorted(models), "reasoning_efforts": sorted(efforts),
                        "codex_versions": sorted(cli_versions)},
            "corroborated_read_requests": sorted(reads),
            "unresolved_read_call_count": unresolved_read_calls, "issues": sorted(issues)}


def experiment_dimensions(run):
    """Optional schema-2 dimensions; schema-1 callers/ledgers remain unchanged."""
    if 'experiment' not in run:
        return {}
    for key in ('experiment','harness'):
        if label(run.get(key)) is None:
            raise MetricsError('invalid_experiment_dimension')
    role=run.get('role')
    if role not in ('solver','grader','adjudicator'):
        raise MetricsError('invalid_experiment_role')
    if role=='solver':
        if run.get('condition') not in ('skill','no-skill') or run.get('trial') not in (1,2,3):
            raise MetricsError('invalid_condition_or_trial')
        expected='provided' if run['condition']=='skill' else 'intentionally_absent'
        if run.get('skill_availability')!=expected:
            raise MetricsError('invalid_skill_availability')
        if expected=='intentionally_absent' and run.get('skill_digest') is not None:
            raise MetricsError('baseline_has_skill_digest')
    return {k:run.get(k) for k in ('experiment','condition','trial','harness','role','skill_availability')}


def build_ledger(manifest):
    if manifest.get("schema_version") != 1 or not isinstance(manifest.get("runs"), list):
        raise MetricsError("unsupported_manifest")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", manifest.get("measured_on", "")):
        raise MetricsError("invalid_measurement_date")
    records, run_ids, sessions, selections = [], set(), set(), set()
    for run in manifest["runs"]:
        run_id, case, variant = run.get("run_id"), run.get("case_id"), run.get("variant")
        if not isinstance(run_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", run_id):
            raise MetricsError("invalid_run_identifier")
        if not isinstance(case, str) or not re.fullmatch(r"\d{2}", case) or (variant is not None and label(variant) is None):
            raise MetricsError("invalid_case_variant")
        if run_id in run_ids or run.get("expected_thread_id") in sessions:
            raise MetricsError("duplicate_run_or_session_mapping")
        if not isinstance(run.get("expected_thread_id"), str) or not run["expected_thread_id"]:
            raise MetricsError("missing_session_binding")
        run_ids.add(run_id)
        sessions.add(run.get("expected_thread_id"))
        grade = json.loads(Path(run["grade"]).read_text())
        recorded_case = grade.get("case") or grade.get("run", "").split("-", 1)[0]
        if recorded_case != case:
            raise MetricsError("case_grade_binding_mismatch")
        if variant is not None and grade.get("run") not in (
                case + "-" + variant, case + "-" + variant + "-r1", case + "-" + variant + "-final"):
            raise MetricsError("variant_grade_binding_mismatch")
        outcome = grade.get("result")
        if outcome not in ("pass", "fail", "ungraded", "blocked"):
            raise MetricsError("invalid_grade_outcome")
        selected = run.get("selected")
        if type(selected) is not bool or (selected and outcome != "pass"):
            raise MetricsError("invalid_selection")
        if selected:
            if (case, variant) in selections:
                raise MetricsError("duplicate_selected_case_variant")
            selections.add((case, variant))
        skill = tree_digest(run["skill_dir"])
        if skill != grade.get("skillDigest"):
            raise MetricsError("skill_digest_mismatch")
        folder = Path(run["input_dir"])
        if "packetDigest" in grade:
            inputs, algorithm = tree_digest(folder), "input_tree_sha256"
            expected = grade["packetDigest"]
        else:
            inputs = hashlib.sha256((folder / "prompt.md").read_bytes() + b"\0"
                                    + (folder / "evidence.json").read_bytes()).hexdigest()
            algorithm, expected = "prompt_nul_evidence_sha256", grade.get("caseInputDigest")
        if inputs != expected or not HEX.fullmatch(grade.get("rubricDigest", "")):
            raise MetricsError("input_or_rubric_digest_invalid")
        expected_turns = run.get("expected_turns")
        if type(expected_turns) is not int or expected_turns < 1:
            raise MetricsError("invalid_turn_scope")
        texts = [Path(p).read_text() for p in run["transcripts"]]
        if not texts:
            raise MetricsError("transcript_unavailable")
        expected_names = grade.get("transcripts") or [grade.get("transcript", "")]
        if [Path(p).name for p in run["transcripts"]] != [Path(p).name for p in expected_names]:
            raise MetricsError("transcript_grade_binding_mismatch")
        trace = extract_trace(run["telemetry"], run["expected_thread_id"], expected_turns, run["skill_dir"])
        references = declared_references(texts, run["skill_dir"])
        references["corroborated_read_requests"] = trace.pop("corroborated_read_requests")
        references["unresolved_read_call_count"] = trace.pop("unresolved_read_call_count")
        references["basis"] = "declared_final_read_lists; corroboration only for recognized literal read requests"
        records.append({"run_id": run_id, "case_id": case, "variant": variant,
                        "correctness": outcome, "selected": selected,
                        "skill_digest": skill, "input_digest": inputs,
                        "input_digest_algorithm": algorithm, "rubric_digest": grade["rubricDigest"],
                        "grade_digest": hashlib.sha256(Path(run["grade"]).read_bytes()).hexdigest(),
                        "transcript_digests": [hashlib.sha256(text.encode()).hexdigest() for text in texts],
                        "expected_turns": expected_turns, "source": "local_codex_jsonl",
                        **trace, "references": references})
    return {"schema_version": 1, "measured_on": manifest["measured_on"],
            "scope": "solver contexts only; evaluator/orchestration excluded; no branch attribution",
            "tool_call_scope": "unique model-visible calls, including failures and output writes; not nested backend operations",
            "records": sorted(records, key=lambda r: (r["case_id"], r["variant"] or "", r["run_id"]))}


def render_baselines(ledger):
    records = ledger["records"]
    models = sorted({value for r in records for value in r["runtime"].get("models", [])})
    efforts = sorted({value for r in records for value in r["runtime"].get("reasoning_efforts", [])})
    versions = sorted({value for r in records for value in r["runtime"].get("codex_versions", [])})
    lines = ["<!-- cost-metrics:start -->", "", "## Measured cost baselines", "",
             "Backfilled on " + ledger["measured_on"] + " from explicitly mapped local solver telemetry. "
             "Historical correctness grades are unchanged; this is not a new correctness audit. "
             "All runs, including failures and reruns, are retained in [the sanitized ledger](cost-metrics.json).", "",
             f"Coverage: {len(records)} solver contexts; "
             f"{sum(r['tokens']['status'] == 'measured' for r in records)} reconciled token totals; "
             f"{sum(r['tool_calls']['status'] == 'measured' for r in records)} measured call counts; "
             f"{sum(r['references']['status'] == 'declared' for r in records)} reference declarations. "
             "Recorded models: " + (", ".join(models) or "unavailable") + "; reasoning efforts: "
             + (", ".join(efforts) or "unavailable") + "; Codex versions: "
             + (", ".join(versions) or "unavailable") + ". These details were found after the original grading.", "",
             "The table selects the latest passing run for each case/variant. Different snapshots, inputs, "
             "harness context and single-run variation prevent causal savings claims. Snapshot is the "
             "skill digest prefix; full tested hashes are in the ledger. A case with multiple "
             "branches has one context total. Case 03 includes both approval turns; per-turn tokens remain in the ledger.", "",
             "| Case/variant | Run | Snapshot | Input | Cached input | Output | Total | Calls | References |",
             "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for record in ledger["records"]:
        if not record["selected"]:
            continue
        tokens = record["tokens"]
        values = tokens["values"] or {}
        def number(key):
            value = values.get(key)
            return f"{value:,}" if value is not None and tokens["status"] == "measured" else "N/A"
        calls = record["tool_calls"]
        call_count = str(calls["count"]) if calls["status"] == "measured" else "N/A"
        refs = record["references"]
        ref_count = str(refs["count"]) + " declared" if refs["status"] == "declared" else "N/A"
        subject = record["case_id"] + (" / " + record["variant"] if record["variant"] else "")
        lines.append("| " + " | ".join([subject, record["run_id"], "`" + record["skill_digest"][:12] + "`",
                     *(number(k) for k in ("input_tokens", "cached_input_tokens", "output_tokens", "total_tokens")),
                     call_count, ref_count]) + " |")
    lines += ["", "Input includes repeated harness/context processing. Cached input is a subset of input; "
              "reasoning tokens are reported separately in the ledger and are not added again to output/total. "
              "Response usage is deduplicated and reconciled with final cumulative counters. Calls include "
              "failed calls and transcript writes; nested backend operations are not separately observable. "
              "Reference counts are unique declared reference files, excluding the core, prompts and fixtures. "
              "Recognized read requests corroborate some declarations but do not prove complete content delivery "
              "or an exhaustive filesystem audit.", "",
              "Missing, partial or conflicting metrics are N/A here, with observed values/reasons retained in "
              "the ledger. These offline fixture costs do not measure live evidence gathering. No dollar-cost "
              "estimate, budget threshold, reliability estimate, or comparison with a no-skill baseline is implied.", "",
              "<!-- cost-metrics:end -->"]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--results", type=Path, help="Update only the marked baseline section in an existing Markdown file")
    args = parser.parse_args()
    try:
        ledger = build_ledger(json.loads(args.manifest.read_text()))
        rendered = render_baselines(ledger)
        results = args.results.read_text() if args.results else None
        if results is not None:
            start, end = "<!-- cost-metrics:start -->", "<!-- cost-metrics:end -->"
            if results.count(start) != results.count(end) or results.count(start) > 1:
                raise MetricsError("invalid_result_markers")
            results = (results[:results.index(start)] + rendered.rstrip("\n") + results[results.index(end) + len(end):]
                       if start in results else results.rstrip() + "\n\n" + rendered)
        args.output.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
        if args.results:
            args.results.write_text(results)
    except (MetricsError, OSError, json.JSONDecodeError) as error:
        message = str(error) if isinstance(error, MetricsError) else "input_or_output_unavailable"
        parser.exit(2, "Metrics not published: " + message + "\n")
    print("Published metrics for " + str(len(ledger["records"])) + " explicitly mapped runs.")


if __name__ == "__main__":
    main()
