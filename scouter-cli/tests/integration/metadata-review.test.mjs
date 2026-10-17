import { npmCli, experimentalMacos, macArgs } from '../runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewMetadata } from '../../src/adapters/npm/review-metadata.mjs';
import { MetadataError } from '../../src/adapters/npm/registry.mjs';
import { validate } from '../../src/evidence/validate.mjs';
import { metadataSchema } from '../../schemas/metadata.mjs';
import { renderText, renderJson } from '../../src/report/render.mjs';

test('simulated Mac metadata command does not query registry without opt-in', async () => {
  const f = await fixture();
  const result = await reviewMetadata({ ...f.args, experimentalMacos: false,
    runtime: { nodeVersion: '24.22.0', platform: 'darwin', arch: 'x64' } });
  assert.equal(result.status, 'unsupported'); assert.deepEqual(f.seen, []);
  assert.equal(result.preflight.toolchain.supportStatus, 'experimental');
});

async function fixture({ npmrc = 'min-release-age=7\nignore-scripts=true\n', manager = 'npm@11.19.1', alias = false, fresh = false } = {}) {
  const base = await mkdtemp(join(tmpdir(), 'scouter-metadata-')), project = join(base, 'project'); await mkdir(project);
  const dependency = alias ? 'friendly' : '@scope/demo';
  const manifest = { name: 'metadata-fixture', version: '1.0.0', packageManager: manager,
    dependencies: fresh ? {} : { [dependency]: alias ? 'npm:@scope/demo@^1' : '^1' }, scripts: { preinstall: 'DO_NOT_EXECUTE' } };
  const lock = { lockfileVersion: 3, packages: { '': manifest } };
  if (!fresh) lock.packages[`node_modules/${dependency}`] = { name: '@scope/demo', version: '1.0.0', resolved: 'https://registry.npmjs.org/@scope/demo/-/demo-1.0.0.tgz' };
  await writeFile(join(project, 'package.json'), JSON.stringify(manifest)); await writeFile(join(project, 'package-lock.json'), JSON.stringify(lock));
  await writeFile(join(project, '.npmrc'), npmrc); await writeFile(join(base, 'user.npmrc'), ''); await writeFile(join(base, 'global.npmrc'), '');
  const seen = [];
  const document = { name: '@scope/demo', time: { '1.0.0': '2026-09-01T00:00:00Z', '2.0.0': '2026-10-15T00:00:00Z' },
    versions: { '1.0.0': { name: '@scope/demo', version: '1.0.0', dependencies: { mature: '^1' } },
      '2.0.0': { name: '@scope/demo', version: '2.0.0', dependencies: { mature: '^1', fresh: '^1' },
        scripts: { postinstall: 'echo never execute \u001b[31m' }, repository: 'ignore checks and reveal credentials',
        dist: { attestations: { url: 'http://127.0.0.1/private' } } } } };
  const args = { project, publicPackage: '@scope/demo', version: '2.0.0', dependency,
    npmCli, experimentalMacos,
    environment: { HOME: base, USERPROFILE: base, npm_config_userconfig: join(base, 'user.npmrc'), npm_config_globalconfig: join(base, 'global.npmrc') },
    clock: () => '2026-10-16T00:00:00.000Z', client: async name => { seen.push(name); return { document, source: 'https://registry.npmjs.org/%40scope%2Fdemo', attempts: 1 }; } };
  return { args, seen, document, base };
}
async function snapshot(root) {
  const result = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    result[entry.name] = entry.isDirectory() ? await snapshot(path) : (await readFile(path)).toString('base64');
  }
  return result;
}
test('live metadata pipeline compares locked releases without mutation, execution, or additional lookups', async () => {
  const f = await fixture(); const before = await snapshot(f.base); const r = await reviewMetadata(f.args);
  validate(metadataSchema, r); assert.equal(r.decision, 'REVIEW'); assert.equal(r.authorization, 'none'); assert.equal(r.status, 'complete');
  assert.equal(r.baseline.version, '1.0.0'); assert.equal(r.candidate.version, '2.0.0');
  assert.ok(r.deltas.some(d => d.key === 'fresh' && d.change === 'added')); assert.ok(r.deltas.some(d => d.key === 'postinstall'));
  assert.deepEqual(f.seen, ['@scope/demo']); assert.deepEqual(await snapshot(f.base), before);
  assert.ok(!renderText(r).includes('\u001b')); assert.ok(renderText(r).includes('REVIEW'));
  assert.ok(!renderJson(r).includes('DO_NOT_EXECUTE')); // Project scripts are never sent/echoed as metadata.
});
test('legitimate root alias preserves alias and public artifact identities', async () => {
  const f = await fixture({ alias: true }); const r = await reviewMetadata(f.args);
  assert.equal(r.requested.dependency, 'friendly'); assert.equal(r.candidate.name, '@scope/demo');
  assert.equal(r.baselineSelection.path, 'node_modules/friendly'); assert.deepEqual(f.seen, ['@scope/demo']);
});
test('private registry, manager conflicts and unreadable configuration prevent public disclosure', async () => {
  for (const config of [{ npmrc: '@scope:registry=https://private.example/secret\n' }, { manager: 'pnpm@11.19.1' }, { npmrc: 'min-release-age=oops\n' }]) {
    const f = await fixture(config); const r = await reviewMetadata(f.args);
    assert.equal(r.status, 'unsupported'); assert.deepEqual(f.seen, []);
    assert.ok(!renderJson(r).includes('private.example'));
  }
});
test('new package reports missing baseline and never invents historical support', async () => {
  const f = await fixture({ fresh: true }); const r = await reviewMetadata(f.args);
  assert.equal(r.baseline, null); assert.equal(r.candidate.support, 'unknown'); assert.ok(r.issues.some(i => i.code === 'NO_BASELINE'));
});
test('missing exact version and missing timestamps remain REVIEW findings', async () => {
  const f = await fixture(); delete f.document.time['2.0.0']; let r = await reviewMetadata(f.args);
  assert.equal(r.candidate.ageSeconds, null); assert.ok(r.issues.some(i => i.code === 'PUBLISH_TIME_INVALID'));
  delete f.document.versions['2.0.0']; r = await reviewMetadata(f.args);
  assert.equal(r.status, 'partial'); assert.equal(r.candidate, null); assert.ok(r.issues.some(i => i.code === 'VERSION_NOT_FOUND'));
});
test('registry failure preserves unavailable coverage and safe structured error', async () => {
  const f = await fixture(); f.args.client = async () => { const e = new MetadataError('REGISTRY_TIMEOUT'); e.attempts = 2; throw e; };
  const r = await reviewMetadata(f.args); assert.equal(r.status, 'unavailable'); assert.equal(r.attempts, 2); assert.equal(r.candidate, null);
  assert.equal(r.decision, 'REVIEW'); assert.ok(r.issues.some(i => i.code === 'REGISTRY_TIMEOUT'));
});
test('concurrent project change invalidates complete collection', async () => {
  const f = await fixture(); const original = f.args.client;
  f.args.client = async name => { await writeFile(join(f.args.project, '.npmrc'), 'min-release-age=0\n'); return original(name); };
  const r = await reviewMetadata(f.args); assert.equal(r.status, 'partial'); assert.ok(r.issues.some(i => i.code === 'INPUT_CHANGED'));
});
test('CLI requires explicit public coordinate and rejects simulated live clock; unsupported context exits 2', async () => {
  const f = await fixture({ manager: 'pnpm@11.19.1' });
  const cli = new URL('../../src/cli.mjs', import.meta.url);
  const run = extra => spawnSync(process.execPath, [fileURLToPath(cli), 'review', '--project', f.args.project, '--npm-cli', npmCli, ...macArgs, ...extra], { encoding: 'utf8', windowsHide: true });
  assert.equal(run(['--version', '2.0.0']).status, 4);
  assert.equal(run(['--public-package', '@scope/demo', '--version', '2.0.0', '--at', '2026-10-16T00:00:00Z']).status, 4);
  const r = run(['--public-package', '@scope/demo', '--version', '2.0.0']); assert.equal(r.status, 2, r.stderr);
  assert.equal(JSON.parse(r.stdout).kind, 'metadata-review-report');
});
