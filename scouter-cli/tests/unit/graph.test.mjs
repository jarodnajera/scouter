import test from 'node:test';
import assert from 'node:assert/strict';
import { npmCli } from '../runtime.mjs';
import { readFile } from 'node:fs/promises';
import { loadSemver, normalizeGraph, compareGraphs, compareDeclarations, sanitizeManifest } from '../../src/adapters/npm/graph.mjs';
import { graphSchema } from '../../schemas/graph.mjs';
const semver = await loadSemver(npmCli);
const integrity = `sha512-${Buffer.alloc(64).toString('base64')}`;
const pkg = (name, version = '1.0.0', extra = {}) => ({ version, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, integrity, ...extra });
function fixture() {
  const manifest = { name: 'root', version: '1.0.0', dependencies: { parent: '^1' }, devDependencies: { tool: '^1' } };
  const lock = { lockfileVersion: 3, packages: { '': structuredClone(manifest),
    'node_modules/parent': pkg('parent', '1.0.0', { dependencies: { leaf: '^1' } }),
    'node_modules/leaf': pkg('leaf'), 'node_modules/tool': pkg('tool', '1.0.0', { dev: true }) } };
  return { manifest, lock };
}
const normalize = f => normalizeGraph(f.manifest, f.lock, semver);
test('normalization retains paths, direct/transitive parents and development instances', () => {
  const g = normalize(fixture()); assert.deepEqual(g.issues, []); assert.equal(g.instances.length, 3);
  const leaf = g.instances.find(n => n.name === 'leaf'); assert.equal(leaf.direct, false); assert.deepEqual(leaf.parentPaths, ['node_modules/parent']);
  assert.equal(g.instances.find(n => n.name === 'tool').dev, true);
});
test('same package at nested versions remains distinct; nearest dependency wins', () => {
  const f = fixture(); f.lock.packages['node_modules/parent/node_modules/leaf'] = pkg('leaf', '1.2.0');
  f.manifest.dependencies.leaf = '^1'; f.lock.packages[''].dependencies.leaf = '^1';
  const g = normalize(f); assert.deepEqual(g.issues, []); assert.equal(g.instances.filter(n => n.name === 'leaf').length, 2);
  assert.equal(g.edges.find(e => e.from === 'node_modules/parent').to, 'node_modules/parent/node_modules/leaf');
});
test('scoped aliases preserve artifact identity and dependency name', () => {
  const f = fixture(); f.manifest.dependencies.friendly = 'npm:@scope/real@^2'; f.lock.packages[''].dependencies.friendly = 'npm:@scope/real@^2';
  f.lock.packages['node_modules/friendly'] = pkg('@scope/real', '2.1.0', { name: '@scope/real' });
  const g = normalize(f); assert.deepEqual(g.issues, []); const n = g.instances.find(n => n.installedAs === 'friendly');
  assert.equal(n.name, '@scope/real'); assert.equal(g.edges.find(e => e.dependency === 'friendly').spec, 'npm:@scope/real@^2');
});
test('peer lookup uses ancestor placement, optional peers may be absent', () => {
  const f = fixture(); f.lock.packages['node_modules/parent'].peerDependencies = { tool: '^1', absent: '^1' };
  f.lock.packages['node_modules/parent'].peerDependenciesMeta = { absent: { optional: true } };
  const g = normalize(f); assert.deepEqual(g.issues, []);
  assert.equal(g.edges.find(e => e.from === 'node_modules/parent' && e.dependency === 'tool').to, 'node_modules/tool');
  assert.equal(g.edges.find(e => e.dependency === 'absent').optional, true);
});
test('peer cannot be satisfied by its own nested child; missing required peers are explicit', () => {
  const f = fixture(); f.lock.packages['node_modules/parent'].peerDependencies = { peer: '^1' };
  f.lock.packages['node_modules/parent/node_modules/peer'] = pkg('peer');
  assert.ok(normalize(f).issues.some(i => i.code === 'MISSING_DEPENDENCY'));
});
test('optional overrides normal declaration; all platform-conditional nodes stay visible', () => {
  const f = fixture(); Object.assign(f.lock.packages['node_modules/parent'], { optionalDependencies: { leaf: '^1' } });
  Object.assign(f.lock.packages['node_modules/leaf'], { optional: true, devOptional: true, os: ['linux', '!win32'], cpu: ['arm64'], libc: ['musl'], engines: { node: '>=24' }, hasInstallScript: true });
  const g = normalize(f); assert.equal(g.edges.filter(e => e.dependency === 'leaf').length, 1);
  assert.equal(g.edges.find(e => e.dependency === 'leaf').type, 'optionalDependencies');
  assert.deepEqual(g.instances.find(n => n.name === 'leaf').conditions.os, ['linux', '!win32']);
});
test('mismatched roots and unsatisfied ranges prevent complete graph coverage', () => {
  const f = fixture(); f.lock.packages[''].dependencies.parent = '^2'; f.lock.packages['node_modules/leaf'].version = '2.0.0';
  const codes = normalize(f).issues.map(i => i.code); assert.ok(codes.includes('MANIFEST_LOCK_MISMATCH')); assert.ok(codes.includes('DEPENDENCY_RANGE_MISMATCH'));
});
test('Git, URL, local, tag, overrides, workspace and linked sources are unsupported', () => {
  for (const spec of ['git+https://host/repo', 'https://user:SECRET@host/a', 'file:../a', 'workspace:*', 'latest']) {
    const f = fixture(); f.manifest.dependencies.parent = spec; f.lock.packages[''].dependencies.parent = spec;
    const g = normalize(f); assert.ok(g.issues.some(i => i.code === 'UNSUPPORTED_DEPENDENCY_SPEC')); assert.ok(!JSON.stringify(g).includes('SECRET'));
  }
  const f = fixture(); f.manifest.overrides = { leaf: '1.0.0' }; f.lock.packages['node_modules/leaf'].link = true;
  assert.ok(normalize(f).issues.some(i => i.code === 'UNSUPPORTED_ROOT_CONFIGURATION'));
  assert.ok(normalize(f).issues.some(i => i.code === 'UNSUPPORTED_PACKAGE_SOURCE'));
});
test('malformed path traversal, missing integrity and orphan cycles cannot pass', () => {
  const f = fixture(); f.lock.packages['../escape'] = pkg('evil'); assert.throws(() => normalize(f)); delete f.lock.packages['../escape'];
  f.lock.packages['node_modules/a'] = pkg('a', '1.0.0', { dependencies: { b: '*' } });
  f.lock.packages['node_modules/b'] = pkg('b', '1.0.0', { dependencies: { a: '*' } });
  delete f.lock.packages['node_modules/leaf'].integrity;
  const codes = normalize(f).issues.map(i => i.code); assert.ok(codes.includes('UNREACHABLE_INSTANCE')); assert.ok(codes.includes('INTEGRITY_EVIDENCE_INVALID'));
});
test('graph diff records upgrades, downgrades, moved paths, integrity and origin changes', () => {
  const f = fixture(), base = normalize(f);
  f.lock.packages['node_modules/leaf'] = pkg('leaf', '1.1.0', { integrity: `sha512-${Buffer.alloc(64, 1).toString('base64')}` });
  f.lock.packages['node_modules/tool'] = pkg('tool', '0.9.0', { resolved: 'https://mirror.invalid/tool.tgz' });
  const changes = compareGraphs(base, normalize(f), semver);
  assert.ok(changes.find(c => c.path === 'node_modules/leaf').kinds.includes('upgraded'));
  assert.ok(changes.find(c => c.path === 'node_modules/leaf').kinds.includes('integrity-changed'));
  assert.ok(changes.find(c => c.path === 'node_modules/tool').kinds.includes('downgraded'));
  assert.ok(changes.find(c => c.path === 'node_modules/tool').kinds.includes('origin-changed'));
  f.lock.packages['node_modules/parent/node_modules/leaf'] = f.lock.packages['node_modules/leaf']; delete f.lock.packages['node_modules/leaf'];
  const moved = compareGraphs(base, normalize(f), semver); assert.ok(moved.some(c => c.kinds.includes('added'))); assert.ok(moved.some(c => c.kinds.includes('removed')));
});
test('manifest declarations and graph drift are separate; outgoing edge changes are retained', () => {
  const f = fixture(), base = normalize(f); f.lock.packages['node_modules/parent'].dependencies.leaf = '>=1';
  assert.ok(compareGraphs(base, normalize(f), semver).some(c => c.kinds.includes('edges-changed')));
  assert.deepEqual(compareDeclarations(f.manifest, f.manifest, semver), []);
  const next = structuredClone(f.manifest); next.dependencies.parent = '^2'; assert.equal(compareDeclarations(f.manifest, next, semver).length, 1);
});
test('canonical normalization is stable under declaration property ordering', () => {
  const f = fixture(); f.manifest.dependencies.z = '*'; f.lock.packages[''].dependencies.z = '*'; f.lock.packages['node_modules/z'] = pkg('z');
  const a = normalize(f); f.manifest.dependencies = { z: '*', parent: '^1' }; f.lock.packages[''].dependencies = { z: '*', parent: '^1' };
  assert.equal(normalize(f).digest, a.digest);
});
test('sanitized proposal excludes scripts, tokens, config and arbitrary metadata', () => {
  const f = fixture(); f.manifest.scripts = { preinstall: 'execute' }; f.manifest.config = { token: 'SECRET' };
  const safe = sanitizeManifest(f.manifest); assert.equal(Object.hasOwn(safe, 'scripts'), false); assert.ok(!JSON.stringify(safe).includes('SECRET'));
});
test('exported graph schema matches source', async () => {
  assert.deepEqual(JSON.parse(await readFile(new URL('../../schemas/graph.schema.json', import.meta.url))), graphSchema);
});

function bundleFixture(extra = {}) {
  const f = fixture();
  f.lock.packages['node_modules/parent'].optionalDependencies = { wasm: '^1' };
  f.lock.packages['node_modules/wasm'] = pkg('wasm', '1.0.0', {
    optional: true, cpu: ['wasm32'], dependencies: { bundled: '^1' }, bundleDependencies: ['bundled'], ...extra,
  });
  return f;
}
const forTarget = (f, platform = 'win32', arch = 'x64') => normalizeGraph(f.manifest, f.lock, semver, { platform, arch });

test('optional excluded bundles remain visible without false missing dependency findings', () => {
  for (const [platform, arch] of [['win32', 'x64'], ['darwin', 'arm64'], ['darwin', 'x64']]) {
    const g = forTarget(bundleFixture(), platform, arch);
    assert.deepEqual(g.issues, [{ code: 'EXCLUDED_OPTIONAL_BUNDLE', path: 'node_modules/wasm' }]);
    assert.ok(g.instances.some(n => n.name === 'wasm'));
    assert.ok(g.edges.some(e => e.dependency === 'bundled' && e.to === null && !e.optional));
  }
});

test('active, unspecified-target, and required bundles cannot pass', () => {
  assert.ok(normalize(bundleFixture()).issues.some(i => i.code === 'BUNDLED_DEPENDENCIES_UNVERIFIED'));
  for (const f of [bundleFixture({ cpu: ['x64'] }), bundleFixture({ optional: false }), bundleFixture({ cpu: [] }), bundleFixture({ cpu: ['any'] })]) {
    assert.ok(forTarget(f).issues.some(i => i.code === 'BUNDLED_DEPENDENCIES_UNVERIFIED'));
  }
  const f = bundleFixture();
  f.manifest.dependencies.wasm = '^1'; f.lock.packages[''].dependencies.wasm = '^1';
  assert.ok(forTarget(f).issues.some(i => i.code === 'BUNDLED_DEPENDENCIES_UNVERIFIED'));
});

test('platform exclusions obey npm positive and negative list semantics', () => {
  for (const extra of [{ cpu: ['!x64'] }, { cpu: ['x64', '!x64'] }, { cpu: [], os: ['linux'] }, { cpu: [], os: ['!win32'] }]) {
    assert.equal(forTarget(bundleFixture(extra)).issues[0].code, 'EXCLUDED_OPTIONAL_BUNDLE');
  }
  for (const extra of [{ cpu: ['!arm64'] }, { cpu: ['x64', 'arm64'] }, { cpu: [], libc: ['musl'] }]) {
    assert.equal(forTarget(bundleFixture(extra)).issues[0].code, 'BUNDLED_DEPENDENCIES_UNVERIFIED');
  }
});

test('bundle declarations do not hide other missing dependencies or required peers', () => {
  const f = bundleFixture();
  f.lock.packages['node_modules/wasm'].dependencies.other = '^1';
  f.lock.packages['node_modules/wasm'].peerDependencies = { bundled: '^1' };
  const g = forTarget(f);
  assert.equal(g.issues.filter(i => i.code === 'MISSING_DEPENDENCY').length, 2);
  delete f.lock.packages['node_modules/leaf'];
  assert.ok(forTarget(f).issues.some(i => i.code === 'MISSING_DEPENDENCY' && i.path === 'node_modules/parent'));
});

test('both bundle spellings and boolean declarations are validated', () => {
  for (const extra of [{ bundleDependencies: true }, { bundleDependencies: undefined, bundledDependencies: ['bundled'] }]) {
    assert.equal(forTarget(bundleFixture(extra)).issues[0].code, 'EXCLUDED_OPTIONAL_BUNDLE');
  }
  assert.ok(forTarget(bundleFixture({ bundleDependencies: false })).issues.some(i => i.code === 'MISSING_DEPENDENCY'));
  for (const extra of [{ bundleDependencies: 'bundled' }, { bundleDependencies: ['../bad'] }, { bundleDependencies: ['bundled', 'bundled'] }, { bundledDependencies: ['different'] }]) {
    assert.throws(() => forTarget(bundleFixture(extra)));
  }
  const f = bundleFixture(); f.lock.packages['node_modules/wasm'].resolved = 'https://untrusted.invalid/wasm.tgz';
  assert.ok(forTarget(f).issues.some(i => i.code === 'UNSUPPORTED_PACKAGE_SOURCE'));
});
