"""Bounded follow-up artifact checks. No models, network or dependency operations."""
import hashlib
import json
from pathlib import Path
import re
import unittest
from metrics import tree_digest
ROOT = Path(__file__).resolve().parent
R4 = ROOT / 'round4'
def read(path):
    return json.loads(path.read_text())
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def pins(text):
    rows = {}
    for line in text.splitlines():
        match = re.fullmatch(r'([\w-]+)==([\w.]+) --hash=sha256:([0-9a-f]{64})', line)
        if not match:
            raise ValueError('pin_not_exact_or_hashed')
        name, version, digest = match.groups()
        if name in rows:
            raise ValueError('duplicate_pin')
        rows[name] = (version, digest)
    return rows
class Round4Artifacts(unittest.TestCase):
    def test_inputs_and_current_skill_bind_to_frozen_revision(self):
        snapshot = read(R4 / 'snapshot.json')
        self.assertEqual(snapshot['plannedContexts'], 6)
        self.assertEqual(tree_digest(ROOT.parent / 'scouter'), snapshot['skillDigest'])
        self.assertEqual(sha(R4 / 'rubric.json'), snapshot['rubricDigest'])
        for row in snapshot['cases']:
            folder = R4 / 'cases' / row['id']
            for filename, field in [('prompt.md', 'promptDigest'), ('evidence.json', 'evidenceDigest'), ('instructions.txt', 'instructionDigest')]:
                self.assertEqual(sha(folder / filename), row[field])
            self.assertEqual(row['skillDigest'], snapshot['skillDigest'] if row['skillAvailable'] else None)
            self.assertEqual(row['followupDigests'], [sha(folder / 'approval.md')] if row['id'] == 'fresh' else [])
    def test_cost_pair_has_equivalent_facts_and_separate_loading(self):
        cases = {r['id']: r for r in read(R4 / 'snapshot.json')['cases']}
        a, b = cases['routine-skill'], cases['routine-baseline']
        self.assertEqual(a['promptDigest'], b['promptDigest'])
        self.assertEqual(a['evidenceDigest'], b['evidenceDigest'])
        self.assertTrue(a['skillAvailable'])
        self.assertFalse(b['skillAvailable'])
        self.assertIsNone(b['skillDigest'])
        first = (R4 / 'cases/routine-skill/instructions.txt').read_text()
        second = (R4 / 'cases/routine-baseline/instructions.txt').read_text()
        self.assertEqual(first.replace('Use the provided Scouter skill; read scouter/SKILL.md and only applicable references. ', ''), second)
    def test_corrected_python_pins_cover_graph_and_metadata(self):
        e = read(R4 / 'cases/uv-pip-corrected/evidence.json')
        self.assertEqual(pins(e['reviewedPins']), pins(e['projectFiles']['reviewed-pins.txt']))
        actual = pins(e['reviewedPins'])
        graph = {n['name']: (n['version'], n['sha256']) for n in e['proposedGraph']['instances']}
        self.assertEqual(actual, graph)
        requires = e['packages'][0]['manifest']['requiresDist']
        self.assertEqual(requires, ['scouter-eval-transitive==1.0.0'])
        # Original inconsistency stays available as historical evidence.
        old = read(ROOT / 'v1/cases/13-uv-pip/evidence.json')
        self.assertNotEqual(pins(old['reviewedPins']), pins(old['projectFiles']['reviewed-pins.txt']))
    def test_results_preserve_failure_approval_turns_and_missing_costs(self):
        result = read(R4 / 'results.json')
        self.assertEqual(result['plannedContexts'], 6)
        self.assertEqual(result['completedContexts'], 6)
        self.assertEqual(len(result['records']), 6)
        self.assertEqual(sum(r['turns'] for r in result['records']), 7)
        self.assertEqual(sum(r['outcome'] == 'pass' for r in result['records']), result['pass'])
        self.assertEqual(sum(r['outcome'] == 'fail' for r in result['records']), result['fail'])
        rows = {r['id']: r for r in result['records']}
        self.assertEqual(rows['fresh']['turns'], 2)
        self.assertEqual(len(rows['fresh']['transcriptDigests']), 2)
        self.assertEqual(rows['uv-pip-corrected']['outcome'], 'fail')
        costs = read(R4 / 'cost-metrics.json')
        self.assertFalse(costs['measuredCostAvailable'])
        self.assertEqual({r['runId'] for r in costs['records']}, set(rows))
        for row in costs['records']:
            self.assertEqual(row['completeness'], 'incomplete')
            self.assertIsNone(row['modelVisibleToolCalls'])
            self.assertTrue(all(v is None for v in row['tokens'].values()))
    def test_live_records_preserve_pending_scope_and_sanitization(self):
        live = read(R4 / 'live-results.json')
        rows = {r['id']: r for r in live['scenarios']}
        tool = rows['npm-tool']
        self.assertEqual(tool['advisoryIdCount'], len({ident for coordinate in tool['affectedCoordinates'] for ident in coordinate['advisoryIds']}))
        self.assertEqual(rows['npm-approved-fresh']['status'], 'pending')
        self.assertEqual(rows['npm-tool']['operation'], 'artifact review only; tool not installed or executed')
        self.assertEqual(rows['npm-rejection']['control'], '--before original absolute cutoff; not --min-release-age')
        self.assertEqual(rows['express-graph']['transitives'], 64)
        self.assertEqual(rows['sphinx-graph']['transitives'], 21)
        self.assertEqual(rows['uv-project']['decision'], 'REVIEW')
        self.assertTrue(rows['pnpm']['lockPreserved'])
        for name in ('results.json', 'live-results.json', 'cost-metrics.json', 'snapshot.json'):
            text = (R4 / name).read_text()
            for forbidden in ('/Users/', '/private/tmp/', 'thread_id', 'api_key', 'raw_tool_arguments'):
                self.assertNotIn(forbidden, text)
if __name__ == '__main__':
    unittest.main()
