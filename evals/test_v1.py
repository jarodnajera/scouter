"""Offline fixture/snapshot checks; never launches agents, commands or network."""
import hashlib,json,unittest
from pathlib import Path
from metrics import tree_digest
ROOT=Path(__file__).resolve().parent
V1=ROOT/"v1"
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
class V1Fixtures(unittest.TestCase):
 def test_manifest_and_scripted_turns_bind_frozen_inputs(self):
  suite=json.loads((V1/"suite.json").read_text());snapshot=json.loads((V1/"snapshot.json").read_text())
  self.assertEqual(len(suite["cases"]),16);self.assertEqual(suite["maxSolverContexts"],16)
  bound={c["id"]:c for c in snapshot["cases"]}
  self.assertEqual(set(bound),{c["id"] for c in suite["cases"]})
  for c in suite["cases"]:
   self.assertTrue(json.loads((V1/c["evidence"]).read_text())["simulation"])
   self.assertEqual(digest(V1/c["prompt"]),bound[c["id"]]["promptDigest"])
   self.assertEqual(digest(V1/c["evidence"]),bound[c["id"]]["evidenceDigest"])
   self.assertEqual([digest(V1/f) for f in suite["followups"].get(c["id"],[])],bound[c["id"]]["followupDigests"])
  self.assertEqual(digest(V1/"rubric.json"),snapshot["rubricDigest"])
  current=json.loads((ROOT/"current-skill.json").read_text())
  self.assertEqual(tree_digest(ROOT.parent/"scouter"),current["skillDigest"])
  self.assertEqual(current["testedSnapshot"],snapshot["skillDigest"])
  self.assertEqual(json.loads((V1/"results.json").read_text())["skillDigest"],snapshot["skillDigest"])
 def test_result_denominators_and_missing_usage_are_explicit(self):
  result=json.loads((V1/"results.json").read_text());rows=result["records"]
  self.assertEqual(len(rows),16);self.assertEqual(sum(r["turns"] for r in rows),22)
  self.assertEqual(sum(r["outcome"]=="pass" for r in rows),result["pass"])
  self.assertEqual(sum(r["outcome"]=="fail" for r in rows),result["fail"])
  self.assertEqual(sum(r["outcome"]=="ungraded" for r in rows),result["ungraded"])
  for r in rows:
   self.assertEqual(r["usage"]["status"],"unavailable");self.assertIsNone(r["usage"]["tokens"])
   self.assertEqual(len(r["transcriptDigests"]),r["turns"])
   self.assertEqual(r["skillDigest"],result["skillDigest"])
 def test_public_records_redact_machine_and_context_identifiers(self):
  for name in ("results.json","snapshot.json","live-results.json"):
   text=(V1/name).read_text()
   for forbidden in ("/Users/","/private/tmp/","thread_id","expected_thread_id","api_key","raw_tool_arguments"):
    self.assertNotIn(forbidden,text)
  live=json.loads((V1/"live-results.json").read_text())
  managers={r["manager"]:r for r in live["scenarios"]}
  self.assertEqual(managers["pnpm"]["stable"]["status"],"blocked")
  self.assertEqual(managers["pnpm"]["stable"]["operation"]["outcome"],"stopped")
  initial=live["initialAttempt"]["managerStatuses"]
  self.assertEqual(initial["pnpm"],"pending user risk acceptance")
  self.assertEqual(initial["pip"],"pending user risk acceptance")
  self.assertEqual(initial["uv"],"unavailable")
  for name in ("pip","uv"):
   stable=managers[name]["stable"];op=stable["operation"]
   self.assertEqual(stable["status"],"completed")
   self.assertTrue(op["pinsPreserved"] and op["installedSourceMatchesReviewed"])
   self.assertFalse(op["sourceBuilds"] or op["scriptExecution"])
   self.assertEqual(op["transitiveCount"],0)
   self.assertEqual(len(op["sha256"]),64)
   self.assertLess(op["simpleIndexUploadTime"],op["nativeArtifactCutoff"])
  for row in managers.values():
   self.assertEqual(row["fresh"]["decision"],"REVIEW")
   self.assertIn("not installed",row["fresh"]["status"])
if __name__=="__main__":unittest.main()
