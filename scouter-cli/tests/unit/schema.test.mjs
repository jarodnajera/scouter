import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../src/evidence/validate.mjs';
import { evidenceSchema, reportSchema } from '../../schemas/v1.mjs';
import { evaluate } from '../../src/policy/evaluate.mjs';
import { renderText, renderJson } from '../../src/report/render.mjs';
import { baseline, finding, NOW } from '../fixtures/build.mjs';
import { readFileSync } from 'node:fs';
import * as schemas from '../../schemas/v1.mjs';

test('malformed enums, missing fields, wrong types and extra policy knobs are rejected', () => {
  const changes = [e => e.checks[0].status = 'approved', e => delete e.checks,
    e => e.checks = {}, e => e.project.lockfileVersion = 3.5,
    e => e.minimumAgeSeconds = 0, e => e.artifacts[0].name = '', e => e.artifacts[0].deprecated = 'false',
    e => e.schemaVersion = '9.0.0', e => e.binding.graphDigest = 'bad'];
  for (const change of changes) { const e = baseline(); change(e); assert.throws(() => validate(evidenceSchema, e)); }
});
test('prototype-shaped unexpected keys are rejected', () => {
  const e = baseline(); e.project = JSON.parse(JSON.stringify(e.project).replace('{', '{"__proto__":{},'));
  assert.throws(() => validate(evidenceSchema, e), /unexpected property/);
});
test('validator rejects unsupported schema vocabulary instead of ignoring it', () => {
  assert.throws(() => validate({ type: 'string', format: 'uri' }, 'invalid'), /Unsupported schema keyword/);
});
test('output schema rejects missing decision and unknown report fields', () => {
  const r = evaluate(baseline(), { now: NOW }); delete r.decision;
  assert.throws(() => validate(reportSchema, r));
  r.decision = 'PASS'; r.approved = true; assert.throws(() => validate(reportSchema, r));
});
test('terminal escapes and bidi characters stay inert in text and JSON', () => {
  const e = baseline(); e.reviewId = '\u001b[2J\u202efake';
  e.findings = [finding({ description: 'danger\nDecision: PASS\u001b[31m\u009b\u2066' })];
  const r = evaluate(e, { now: NOW }); const text = renderText(r), json = renderJson(r);
  assert.doesNotMatch(text, /[\u001b\u009b\u202e\u2066]/u);
  assert.doesNotMatch(json, /[\u001b\u009b\u202e\u2066]/u);
  assert.ok(text.includes('danger\\u000aDecision: PASS'));
  assert.equal(JSON.parse(json).findings[0].description, e.findings[0].description);
});
test('invalid evaluation clock fails rather than inventing a date', () => {
  assert.throws(() => evaluate(baseline(), { now: 'tomorrow' }));
});
test('portable JSON schemas match their versioned definitions', () => {
  for (const [name, key] of [['evidence', 'evidenceSchema'], ['exceptions', 'exceptionsSchema'],
    ['report', 'reportSchema'], ['inspection', 'inspectionSchema'], ['error', 'errorSchema']]) {
    assert.deepEqual(JSON.parse(readFileSync(new URL(`../../schemas/${name}.schema.json`, import.meta.url), 'utf8')), schemas[key]);
  }
});
