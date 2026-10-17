import { npmCli, experimentalMacos, macArgs } from '../runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareProject } from '../../src/adapters/npm/compare.mjs';
import { MetadataError } from '../../src/adapters/npm/registry.mjs';
import { graphSchema } from '../../schemas/graph.mjs';
import { validate } from '../../src/evidence/validate.mjs';
import { renderText } from '../../src/report/render.mjs';

test('simulated Mac graph command creates no snapshots or requests without opt-in', async () => {
  const f = await fixture();
  const result = await compareProject({ ...f.args, experimentalMacos: false,
    runtime: { nodeVersion: '24.22.0', platform: 'darwin', arch: 'arm64' } });
  assert.equal(result.status, 'unsupported'); assert.equal(result.snapshotDirectory, null);
  assert.deepEqual(f.calls, []);
});
const integrity = `sha512-${Buffer.alloc(64).toString('base64')}`;
const entry = (name, version, extra = {}) => ({ version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity, ...extra });
async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'hardhat-graph-test-')), project = join(base, 'project'), candidate = join(base, 'candidate');
  await mkdir(project); await mkdir(candidate);
  const manifest = { name: 'root', version: '1.0.0', packageManager: 'npm@11.19.1', dependencies: { parent: '^1' },
    scripts: { preinstall: 'node canary.cjs' }, config: { token: 'MANIFEST_SECRET' } };
  const baseline = { lockfileVersion: 3, packages: { '': structuredClone(manifest),
    'node_modules/parent': entry('parent', '1.0.0', { dependencies: { leaf: '^1' } }),
    'node_modules/leaf': entry('leaf', '1.0.0') } };
  const proposal = structuredClone(baseline); proposal.packages['node_modules/leaf'] = entry('leaf', '1.1.0', { hasInstallScript: true });
  for (const [path, data] of [[join(project, 'package.json'), manifest], [join(project, 'package-lock.json'), baseline],
    [join(candidate, 'package.json'), manifest], [join(candidate, 'package-lock.json'), proposal]]) await writeFile(path, JSON.stringify(data));
  await writeFile(join(project, '.npmrc'), 'min-release-age=7\nignore-scripts=true\n//registry.npmjs.org/:_authToken=CONFIG_SECRET\n');
  await writeFile(join(project, 'canary.cjs'), "require('node:fs').writeFileSync('CANARY_EXECUTED', 'bad')");
  await writeFile(join(project, 'unrelated.txt'), 'user edits');
  await writeFile(join(base, 'user.npmrc'), ''); await writeFile(join(base, 'global.npmrc'), '');
  const calls = [];
  const args = { project, candidateManifest: join(candidate, 'package.json'), candidateLock: join(candidate, 'package-lock.json'),
    npmCli, experimentalMacos,
    environment: { HOME: base, USERPROFILE: base, npm_config_userconfig: join(base, 'user.npmrc'), npm_config_globalconfig: join(base, 'global.npmrc') },
    clock: () => '2026-10-16T00:00:00.000Z', client: async name => {
      calls.push(name); const versions = name === 'parent' ? ['1.0.0'] : ['1.0.0', '1.1.0'];
      return { source: `https://registry.npmjs.org/${name}`, attempts: 1, document: { name,
        time: Object.fromEntries(versions.map(v => [v, v === '1.1.0' ? '2026-10-15T23:00:00Z' : '2026-09-01T00:00:00Z'])),
        versions: Object.fromEntries(versions.map(version => [version, { name, version, ...(name === 'parent' ? { dependencies: { leaf: '^1' } } : {}),
          dist: { integrity, tarball: entry(name, version).resolved } }])) } };
    } };
  return { base, candidate, manifest, baseline, proposal, args, calls };
}
async function snapshot(root) {
  const out = {};
  for (const e of await readdir(root, { withFileTypes: true })) { const path = join(root, e.name); out[e.name] = e.isDirectory() ? await snapshot(path) : (await readFile(path)).toString('base64'); }
  return out;
}
test('comparison is offline by default, preserves sources, and writes only sanitized snapshots', async () => {
  const f = await fixture(), before = await snapshot(f.base), r = await compareProject(f.args);
  validate(graphSchema, r); assert.equal(r.decision, 'REVIEW'); assert.equal(r.status, 'partial'); assert.equal(r.resolution.available, false);
  assert.deepEqual(f.calls, []); assert.deepEqual(await snapshot(f.base), before);
  assert.deepEqual(r.declarationChanges, []); assert.ok(r.changes.some(c => c.kinds.includes('upgraded')));
  const files = await readdir(r.snapshotDirectory); assert.equal(files.length, 4);
  for (const file of files) {
    const body = await readFile(join(r.snapshotDirectory, file), 'utf8'); assert.ok(!/CONFIG_SECRET|MANIFEST_SECRET|canary.cjs/.test(body));
  }
  assert.ok(!JSON.stringify(r).includes('CONFIG_SECRET'));
});
test('mature unchanged parent resolving fresh transitive is flagged with actual parent paths', async () => {
  const f = await fixture(); const r = await compareProject({ ...f.args, publicPackages: ['parent', 'leaf'] });
  assert.equal(r.status, 'complete'); assert.deepEqual(r.declarationChanges, []); assert.equal(r.decision, 'REVIEW');
  const fresh = r.releases.find(r => r.name === 'leaf'); assert.ok(fresh.issues.includes('AGE_TOO_RECENT')); assert.equal(fresh.ageSeconds, 3600);
  assert.deepEqual(r.candidate.instances.find(n => n.name === 'leaf').parentPaths, ['node_modules/parent']);
  assert.deepEqual(f.calls.sort(), ['leaf', 'parent']); assert.ok(renderText(r).includes('AGE_TOO_RECENT'));
});
test('public permissions cover only explicitly named artifacts; no whole-graph implicit disclosure', async () => {
  const f = await fixture(); const r = await compareProject({ ...f.args, publicPackages: ['parent'] });
  assert.deepEqual(f.calls, ['parent']); assert.ok(r.releases.find(r => r.name === 'leaf').issues.includes('PUBLIC_LOOKUP_NOT_AUTHORIZED'));
});
test('duplicate versions are queried once per public name and retain separate artifact/path records', async () => {
  const f = await fixture(); f.manifest.dependencies.leaf = '^1'; f.proposal.packages[''].dependencies.leaf = '^1';
  f.proposal.packages['node_modules/parent/node_modules/leaf'] = entry('leaf', '1.0.0');
  await writeFile(f.args.candidateManifest, JSON.stringify(f.manifest)); await writeFile(f.args.candidateLock, JSON.stringify(f.proposal));
  const r = await compareProject({ ...f.args, publicPackages: ['parent', 'leaf'] });
  assert.equal(r.releases.filter(r => r.name === 'leaf').length, 2); assert.equal(f.calls.filter(n => n === 'leaf').length, 1);
});
test('unsupported source rejects network lookup and avoids copying credential-bearing specifications', async () => {
  const f = await fixture(); f.manifest.dependencies.parent = 'https://user:SECRET@private.invalid/a.tgz';
  f.proposal.packages[''].dependencies.parent = f.manifest.dependencies.parent;
  await writeFile(f.args.candidateManifest, JSON.stringify(f.manifest)); await writeFile(f.args.candidateLock, JSON.stringify(f.proposal));
  const r = await compareProject({ ...f.args, publicPackages: ['parent', 'leaf'] });
  assert.equal(r.status, 'unsupported'); assert.deepEqual(f.calls, []); assert.equal(r.snapshotDirectory, null); assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('private routing prevents comparison/public lookup before external proposal processing', async () => {
  const f = await fixture(); await writeFile(join(f.args.project, '.npmrc'), 'registry=https://private.invalid/\n');
  const r = await compareProject({ ...f.args, publicPackages: ['parent', 'leaf'] }); assert.equal(r.status, 'unsupported'); assert.deepEqual(f.calls, []);
});
test('missing proposal fails closed instead of invoking an unqualified resolver', async () => {
  const f = await fixture(); const r = await compareProject({ ...f.args, candidateManifest: undefined, candidateLock: undefined });
  assert.equal(r.status, 'unavailable'); assert.equal(r.snapshotDirectory, null); assert.deepEqual(f.calls, []);
  assert.ok(r.issues.some(i => i.code === 'RESOLUTION_ISOLATION_UNAVAILABLE'));
});
test('baseline override must match current project bytes and root manifest', async () => {
  const f = await fixture(); const r = await compareProject({ ...f.args, baselineLock: f.args.candidateLock });
  assert.equal(r.status, 'unsupported'); assert.ok(r.issues.some(i => i.code === 'BASELINE_CHANGED_OR_MISMATCHED')); assert.deepEqual(f.calls, []);
});
test('registry outages retain unavailable release checks and never grant approval', async () => {
  const f = await fixture(); const r = await compareProject({ ...f.args, publicPackages: ['parent', 'leaf'], client: async () => { throw new MetadataError('REGISTRY_TIMEOUT'); } });
  assert.equal(r.status, 'partial'); assert.ok(r.releases.every(r => r.issues.includes('REGISTRY_TIMEOUT'))); assert.equal(r.decision, 'REVIEW');
});
test('exact locked releases also honor the stronger effective project cutoff', async () => {
  const f = await fixture(); await writeFile(join(f.args.project, '.npmrc'), 'min-release-age=60\nignore-scripts=true\n');
  const r = await compareProject({ ...f.args, publicPackages: ['parent'] });
  assert.ok(r.releases.find(r => r.name === 'parent').issues.includes('PROJECT_CUTOFF_NOT_MET'));
});
test('registry dependencies omitted by a supplied lock cannot be treated as matching graph evidence', async () => {
  const f = await fixture(), original = f.args.client;
  const r = await compareProject({ ...f.args, publicPackages: ['parent'], client: async name => {
    const result = await original(name); result.document.versions['1.0.0'].dependencies.hidden = '^1'; return result;
  } });
  assert.ok(r.releases.find(r => r.name === 'parent').issues.includes('REGISTRY_LOCK_DEPENDENCIES_MISMATCH'));
  assert.deepEqual(f.calls, ['parent']);
});
test('interrupted collection retains only task snapshots and leaves all source/config files unchanged', async () => {
  const f = await fixture(), before = await snapshot(f.base);
  const oldDirs = new Set((await readdir(tmpdir())).filter(n => n.startsWith('hardhat-proposal-')));
  await assert.rejects(compareProject({ ...f.args, publicPackages: ['parent'], client: async () => { throw new Error('simulated interruption'); } }), /simulated interruption/);
  assert.deepEqual(await snapshot(f.base), before);
  const retained = (await readdir(tmpdir())).filter(n => n.startsWith('hardhat-proposal-') && !oldDirs.has(n));
  assert.ok(retained.length > 0);
  for (const dir of retained) assert.ok((await readdir(join(tmpdir(), dir))).includes('candidate-graph.json'));
});
test('changed proposal during release collection invalidates collected graph snapshot', async () => {
  const f = await fixture(); const original = f.args.client;
  const r = await compareProject({ ...f.args, publicPackages: ['parent'], client: async name => {
    await writeFile(f.args.candidateManifest, JSON.stringify({ ...f.manifest, description: 'changed concurrently' })); return original(name);
  } });
  assert.equal(r.status, 'partial'); assert.ok(r.issues.some(i => i.code === 'INPUT_CHANGED'));
});
test('CLI comparison exits REVIEW with valid JSON and rejects half-proposals or offline clocks', async () => {
  const f = await fixture(); const cli = fileURLToPath(new URL('../../src/cli.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, 'compare', '--project', f.args.project, '--npm-cli', npmCli, ...macArgs, ...args], { encoding: 'utf8', windowsHide: true });
  const r = run(['--candidate-manifest', f.args.candidateManifest, '--candidate-lock', f.args.candidateLock]);
  assert.equal(r.status, 2, r.stderr); assert.equal(JSON.parse(r.stdout).kind, 'graph-review-report');
  assert.equal(run(['--candidate-lock', f.args.candidateLock]).status, 4);
  assert.equal(run(['--at', '2026-10-16T00:00:00Z']).status, 4);
});
