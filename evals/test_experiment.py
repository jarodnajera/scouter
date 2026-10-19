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


    def synthetic_grade(self, key):
        mapping=json.loads((self.base/'blind-mappings'/(key+'.json')).read_text())
        rubric=json.loads((self.base/'rubric.json').read_text())
        responses={}
        for anon in mapping['responses']:
            available=mapping.get('availability',{}).get(anon,True)
            citation={'location':'report','quote':'reviewed exact package'} if available else {'location':'unavailable placeholder','omission':True}
            responses[anon]={group:{k:{'status':'pass' if available else 'ungraded','evidence':copy.deepcopy(citation)} for k in set(rubric[group+'_global']) | set(rubric['cases'][key[:2]][group])} for group in ('shared','scouter')}
            responses[anon]['critical_failures']=[]
        return {'schema_version':1,'case_key':key,'packet_digest':mapping['packet_digest'],'responses':responses}

    def test_partial_packet_preserves_missing_slots_and_anonymity(self):
        (self.base/'responses').mkdir()
        m,_=e.load(self.base)
        rows=[r for r in m['runs'] if r['case_key']=='01']
        for r in rows[:4]:
            (self.base/'responses'/(r['run_id']+'.md')).write_text('reviewed exact package '+str(self.base)+'/packets/'+r['run_id'])
        with contextlib.redirect_stdout(io.StringIO()):e.grader_packet(self.base,'01',available_only=True)
        mapping=json.loads((self.base/'blind-mappings/01.json').read_text())
        self.assertEqual(sum(mapping['availability'].values()),4)
        self.assertEqual(len(list((self.base/'responses').iterdir())),4)
        for file in (self.base/'graders/01').glob('response-*.md'):
            text=file.read_text()
            self.assertNotIn(str(self.base),text)
            self.assertTrue(all(r['run_id'] not in text for r in rows))
        grade=self.synthetic_grade('01');e.dump(self.base/'grades/01.json',grade);e.validate_grade(self.base,'01')
        missing=next(k for k,v in mapping['availability'].items() if not v)
        grade['responses'][missing]['shared']['offline']['status']='pass'
        e.dump(self.base/'grades/01.json',grade)
        with self.assertRaisesRegex(ValueError,'unavailable_response'):e.validate_grade(self.base,'01')

    def test_nested_citation_and_packet_tamper(self):
        (self.base/'responses').mkdir()
        m,_=e.load(self.base)
        for r in m['runs']:
            if r['case_key']=='01':(self.base/'responses'/(r['run_id']+'.md')).write_text('reviewed exact package')
        with contextlib.redirect_stdout(io.StringIO()):e.grader_packet(self.base,'01')
        grade=self.synthetic_grade('01');e.dump(self.base/'grades/01.json',grade);e.validate_grade(self.base,'01')
        grade['responses']['response-1']['shared']['offline']['evidence']['quote']='fabricated citation'
        e.dump(self.base/'grades/01.json',grade)
        with self.assertRaisesRegex(ValueError,'quote_not_in_response'):e.validate_grade(self.base,'01')
        e.dump(self.base/'grades/01.json',self.synthetic_grade('01'))
        (self.base/'graders/01/response-1.md').write_text('tampered')
        with self.assertRaisesRegex(ValueError,'grade_binding'):e.validate_grade(self.base,'01')

    def test_registration_accepts_lifecycle_metadata(self):
        state=json.loads((self.base/'state.json').read_text());state['execution_status']='stopped_at_user_request';state['grading_date']='2026-10-18';e.dump(self.base/'state.json',state)
        e.register(self.base,'01','/root/grader')
        self.assertIn('01',json.loads((self.base/'state.json').read_text())['graders'])


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

class ComparisonTests(unittest.TestCase):
    def rows(self):
        rubric=json.loads((Path(__file__).parent/'experiment-rubric.json').read_text())
        keys=set(rubric['shared_global']) | set(rubric['cases']['13']['shared'])
        rows=[]
        for trial in (1,2,3):
            for condition in e.CONDITIONS:
                status='pass' if trial==1 or (trial==2 and condition=='skill') or (trial==3 and condition=='no-skill') else 'fail'
                criteria={k:'pass' for k in keys};criteria['routine']=status
                rows.append({'case_key':'13-npm','trial':trial,'condition':condition,'status':'graded','shared':status,'critical_failures':0,'critical_kinds':[],
                    'criterion_statuses':{'shared':criteria,'scouter':{'loading_reporting':'fail'}}})
        return rows,rubric
    def test_paired_comparison_ignores_policy_and_tracks_task_handling(self):
        rows,rubric=self.rows()
        with patch.object(e,'KEYS',['13-npm']):result=e.comparison(rows,rubric)
        p=result['paired_summary']
        self.assertEqual((p['both_pass'],p['scouter_only_pass'],p['baseline_only_pass'],p['neither_pass']),(1,1,1,0))
        self.assertEqual(p['shared_pass_difference_percentage_points'],0)
        for condition in e.CONDITIONS:
            self.assertEqual(result['conditions'][condition]['eligible_task_handling']['pass'],2)
            self.assertEqual(result['conditions'][condition]['graded'],3)
    def test_incomplete_pairs_remain_ungraded_and_critical_costs_separate(self):
        rows,rubric=self.rows()
        for row in rows:
            if row['trial']==3:
                row.update(status='not-run',shared='ungraded',critical_failures=None,criterion_statuses={})
        rows[2]['critical_failures']=1;rows[2]['critical_kinds']=['disclosure']
        with patch.object(e,'KEYS',['13-npm']):result=e.comparison(rows,rubric)
        self.assertEqual((result['paired_summary']['graded'],result['paired_summary']['available'],result['paired_summary']['planned']),(2,2,3))
        self.assertEqual(result['paired_summary']['ungraded'],1)
        self.assertEqual(result['conditions']['skill']['critical_trials'],1)
        self.assertEqual(result['conditions']['skill']['critical_trial_denominator'],2)
        self.assertEqual(result['conditions']['skill']['eligible_task_handling']['ungraded'],1)


if __name__=='__main__':unittest.main()
