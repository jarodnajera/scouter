import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { baseline, exception, NOW } from '../fixtures/build.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = name => join(root, 'tests/fixtures', `${name}.json`);
const invoke = (...args) => spawnSync(process.execPath, [join(root, 'src/cli.mjs'), ...args], {
  encoding: 'utf8', timeout: 10000, windowsHide: true, shell: false,
});
const args = name => ['review', '--evidence', fixture(name), '--at', NOW];
const checksum = file => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const [name, decision, exit] of [['pass', 'PASS', 0], ['review', 'REVIEW', 2], ['block', 'BLOCK', 3], ['unsupported', 'REVIEW', 2]]) {
  test(`CLI ${name}: correct exit, valid JSON and no source mutation`, () => {
    const before = checksum(fixture(name)); const p = invoke(...args(name));
    assert.equal(p.status, exit, p.stderr); const report = JSON.parse(p.stdout);
    assert.equal(report.kind, 'review-report'); assert.equal(report.decision, decision);
    assert.equal(report.authorization, 'none'); assert.equal(p.stderr, '');
    assert.equal(checksum(fixture(name)), before);
  });
}
test('text and JSON report the same decision; text is not mixed into JSON', () => {
  const p = invoke(...args('block'), '--format', 'text'); assert.equal(p.status, 3);
  assert.match(p.stdout, /^Decision: BLOCK/); assert.equal(p.stderr, '');
});
test('inspection has separate kind and never an approval decision', () => {
  for (const [name, code] of [['pass', 0], ['unsupported', 2]]) {
    const p = invoke('inspect', '--evidence', fixture(name), '--at', NOW);
    assert.equal(p.status, code); const r = JSON.parse(p.stdout);
    assert.equal(r.kind, 'inspection-report'); assert.equal(Object.hasOwn(r, 'decision'), false);
  }
});
test('malformed options, unsupported commands and missing files fail without a decision', () => {
  const cases = [[], ['install'], ['compare'], ['review', '--project', '.'],
    [...args('pass'), '--format', 'xml'], [...args('pass'), '--evidence', fixture('pass')],
    [...args('pass'), '--at'], ['review', '--evidence', 'nonexistent-evidence-file.json'],
    ['inspect', '--evidence', fixture('pass'), '--exceptions', fixture('pass')]];
  for (const parameters of cases) {
    const p = invoke(...parameters); assert.equal(p.status, 4, p.stderr);
    const r = JSON.parse(p.stdout); assert.equal(r.kind, 'error-report');
    assert.equal(Object.hasOwn(r, 'decision'), false); assert.ok(p.stderr.length > 0);
  }
});
test('fixture evidence expires when evaluated later instead of trusting stored PASS', () => {
  const p = invoke('review', '--evidence', fixture('pass'), '--at', '2026-10-17T00:00:00.000Z');
  assert.equal(p.status, 2); assert.ok(JSON.parse(p.stdout).reasons.some(r => r.code === 'STALE_EVIDENCE'));
});
test('CLI reads scoped exception separately without mutating evidence', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'hardhat-phase1-'));
  const e = baseline(); e.artifacts[1].publishedAt = '2026-10-16T17:00:00.000Z';
  const input = join(dir, 'evidence.json'), exceptions = join(dir, 'exceptions.json');
  writeFileSync(input, JSON.stringify(e));
  writeFileSync(exceptions, JSON.stringify({ schemaVersion: '1.0.0', exceptions: [exception(e)] }));
  const before = checksum(input);
  const p = invoke('review', '--evidence', input, '--exceptions', exceptions, '--at', NOW);
  assert.equal(p.status, 0, p.stderr); assert.equal(JSON.parse(p.stdout).appliedExceptions.length, 1);
  assert.equal(checksum(input), before);
});
test('bounded input and schema failures produce usable error JSON', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'hardhat-invalid-'));
  const values = ['{', JSON.stringify({}), ' '.repeat(4 * 1024 * 1024 + 1)];
  for (let i = 0; i < values.length; i++) {
    const path = join(dir, `${i}.json`); writeFileSync(path, values[i]);
    const p = invoke('review', '--evidence', path, '--at', NOW); assert.equal(p.status, 4);
    assert.equal(JSON.parse(p.stdout).code, 'INVALID_INPUT');
  }
});
test('help labels limitations and does not invoke package management', () => {
  const p = invoke('--help'); assert.equal(p.status, 0); assert.match(p.stdout, /offline evidence evaluation/);
});
