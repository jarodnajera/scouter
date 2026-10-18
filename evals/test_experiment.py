"""Offline experiment protocol tests; no models or logged commands execute."""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import experiment as e

class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.patch=patch.object(e,'ROOT',self.root);self.patch.start()
        (self.root/'scouter').mkdir()
        (self.root/'scouter/SKILL.md').write_text('frozen skill')
        (self.root/'evals/followups').mkdir(parents=True)
        (self.root/'evals/followups/03-approved.md').write_text('simulated scoped approval')
        real=Path(__file__).parent
        (self.root/'evals/experiment-rubric.json').write_bytes((real/'experiment-rubric.json').read_bytes())
        for key in e.KEYS:
            folder=e.source_dir(key);folder.mkdir(parents=True)
            (folder/'prompt.md').write_text('# Wrapper\n## User request\nNeutral task')
            (folder/'evidence.json').write_text(json.dumps({'fact':key,'installationLayout':'Skill only','simulation':True}))
        self.base=self.root/'private'
        with contextlib.redirect_stdout(io.StringIO()): e.prepare(self.base)
    def tearDown(self):
        self.patch.stop();self.tmp.cleanup()
    def test_matrix_and_equivalent_baseline_isolation(self):
        m,_=e.load(self.base)
        self.assertEqual(len(m['runs']),114)
        self.assertEqual(m['runs'][0]['condition'],'skill')
        self.assertEqual(m['runs'][38]['condition'],'no-skill')
        for r in m['runs']:
            if r['condition']=='no-skill':
                self.assertIsNone(r['skill_digest'])
                self.assertEqual(r['skill_availability'],'intentionally_absent')
    def test_digest_enforcement(self):
        (self.base/'packets/01-no-skill-t1/evidence.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'packet_digest'): e.load(self.base)
    def test_frozen_reprepare_and_skill_change_rejected(self):
        with self.assertRaises(ValueError): e.prepare(self.base)
        (self.base/'snapshot/scouter/SKILL.md').write_text('changed')
        with self.assertRaisesRegex(ValueError,'snapshot'): e.load(self.base)
    def test_registration_unique_context(self):
        e.register(self.base,'01-skill-t1','/root/a')
        with self.assertRaises(ValueError): e.register(self.base,'01-no-skill-t1','/root/a')
    def test_approval_sequence(self):
        e.register(self.base,'03-skill-t1','/root/a')
        with self.assertRaises(ValueError): e.retain_before_approval(self.base,'03-skill-t1')
        (self.base/'responses').mkdir();(self.base/'responses/03-skill-t1.md').write_text('first held')
        with contextlib.redirect_stdout(io.StringIO()): e.retain_before_approval(self.base,'03-skill-t1')
        with self.assertRaises(ValueError): e.retain_before_approval(self.base,'03-skill-t1')
    def test_grade_completeness_and_evidence(self):
        (self.base/'responses').mkdir()
        m,_=e.load(self.base)
        for r in m['runs']:
            if r['case_key']=='01': (self.base/'responses'/(r['run_id']+'.md')).write_text('reviewed exact package')
        with contextlib.redirect_stdout(io.StringIO()):e.grader_packet(self.base,'01')
        mapping=json.loads((self.base/'blind-mappings/01.json').read_text())
        rubric=json.loads((self.base/'rubric.json').read_text())
        entry={group:{k:{'status':'pass','evidence':'response says reviewed','quote':'reviewed exact package'} for k in list(rubric[group+'_global'])+list(rubric['cases']['01'][group])} for group in ('shared','scouter')}
        entry['critical_failures']=[]
        grade={'schema_version':1,'case_key':'01','packet_digest':mapping['packet_digest'],'responses':{k:copy.deepcopy(entry) for k in mapping['responses']}}
        e.dump(self.base/'grades/01.json',grade);e.validate_grade(self.base,'01')
        del grade['responses']['response-1']['shared']['offline']
        e.dump(self.base/'grades/01.json',grade)
        with self.assertRaisesRegex(ValueError,'incomplete'):e.validate_grade(self.base,'01')
    def test_incomplete_publication_denominators_and_sanitization(self):
        with contextlib.redirect_stdout(io.StringIO()):e.publish(self.base)
        data=json.loads((self.root/'evals/experiment-results.json').read_text())
        self.assertEqual(len(data['records']),114)
        self.assertTrue(all(r['status']=='planned' and r['tokens']['status']=='unavailable' for r in data['records']))
        self.assertNotIn(str(self.root),json.dumps(data))
        self.assertEqual(len(data['grading_records']),19)
        self.assertEqual(e.outcome({'shared':{'a':{'status':'fail'}}},'shared'),'fail')
    def test_export_and_external_rejection(self):
        (self.root/'evals/external-results.schema.json').write_text('{}')
        dest=self.root/'export'
        with contextlib.redirect_stdout(io.StringIO()):e.export(self.base,dest)
        self.assertEqual(len(list((dest/'packets').iterdir())),114)
        m,_=e.load(self.base)
        result={'schema_version':1,'experiment':e.EXPERIMENT,'skill_digest':m['skill_digest'],'rubric_digest':m['rubric_digest'],'runs':[{'run_id':'bogus'}]}
        path=self.root/'external.json';e.dump(path,result)
        with self.assertRaisesRegex(ValueError,'identity'):e.import_external(self.base,path)

    def test_external_valid_and_digest_tamper(self):
        m,_=e.load(self.base);run=m['runs'][0]
        transcript=self.root/'reply.md';transcript.write_text('simulated output')
        item={'run_id':run['run_id'],'packet_digest':run['packet_digest'],'model':'external-model','harness':'external-harness','transcripts':[{'file':'reply.md','sha256':e.sha(transcript)}],'telemetry':{'status':'unavailable'},'approval_sequence':'not_applicable'}
        data={'schema_version':1,'experiment':e.EXPERIMENT,'skill_digest':m['skill_digest'],'rubric_digest':m['rubric_digest'],'runs':[item]}
        path=self.root/'return.json';e.dump(path,data)
        with contextlib.redirect_stdout(io.StringIO()):e.import_external(self.base,path)
        self.assertEqual(len(list((self.base/'external').iterdir())),1)
        transcript.write_text('tampered')
        with self.assertRaisesRegex(ValueError,'transcript_digest'):e.import_external(self.base,path)
    def test_external_approval_and_unsupported_telemetry(self):
        m,_=e.load(self.base);run=next(r for r in m['runs'] if r['case_key']=='03')
        data={'schema_version':1,'experiment':e.EXPERIMENT,'skill_digest':m['skill_digest'],'rubric_digest':m['rubric_digest'],'runs':[{'run_id':run['run_id'],'packet_digest':run['packet_digest'],'approval_sequence':'not_applicable'}]}
        path=self.root/'return.json';e.dump(path,data)
        with self.assertRaisesRegex(ValueError,'approval_sequence'):e.import_external(self.base,path)


    def test_reconstruction_cannot_replace_registration(self):
        published=self.root/'evals/experiment-manifest.json';original=published.read_bytes()
        with contextlib.redirect_stdout(io.StringIO()):e.prepare(self.root/'second-private')
        self.assertEqual(published.read_bytes(),original)
        (self.root/'scouter/SKILL.md').write_text('changed')
        with self.assertRaisesRegex(ValueError,'snapshot_changed'):e.prepare(self.root/'third-private')
        self.assertEqual(published.read_bytes(),original)
    def test_retained_response_cannot_be_replaced(self):
        response=self.base/'responses/01-skill-t1.md';response.parent.mkdir();response.write_text('retained first')
        with contextlib.redirect_stdout(io.StringIO()):e.publish(self.base)
        public=self.root/'evals/experiment-results.json';original=public.read_bytes()
        response.write_text('replacement')
        with self.assertRaisesRegex(ValueError,'retained_response_changed'):e.publish(self.base)
        self.assertEqual(public.read_bytes(),original)
    def test_missing_reports_do_not_leave_partial_grader_packet(self):
        with self.assertRaisesRegex(ValueError,'response_missing'):e.grader_packet(self.base,'01')
        self.assertFalse((self.base/'graders/01').exists())


class MetricDimensionsTests(unittest.TestCase):
    def test_backward_compatible_and_absence_explicit(self):
        from metrics import experiment_dimensions, MetricsError
        self.assertEqual(experiment_dimensions({}),{})
        run={'experiment':'x','harness':'Codex','role':'solver','condition':'no-skill','trial':1,'skill_digest':None,'skill_availability':'intentionally_absent'}
        self.assertEqual(experiment_dimensions(run)['skill_availability'],'intentionally_absent')
        run['skill_digest']='wrong'
        with self.assertRaises(MetricsError):experiment_dimensions(run)

class RangeTests(unittest.TestCase):
    def test_missing_never_zero_and_three_trial_range(self):
        rows=[]
        for value in (10,20,30):
            rows.append({'case_key':'01','condition':'skill','tokens':{'status':'measured','values':{'total_tokens':value}},'tool_calls':{'status':'measured','count':2},'references':{'status':'declared','count':1}})
        result=e.cost_ranges(rows)[0]['metrics']
        self.assertEqual(result['total_tokens']['min'],10)
        self.assertEqual(result['total_tokens']['max'],30)
        self.assertIsNone(result['input_tokens']['min'])
        rows.pop();self.assertIsNone(e.cost_ranges(rows)[0]['metrics']['total_tokens']['min'])

if __name__=='__main__':unittest.main()
