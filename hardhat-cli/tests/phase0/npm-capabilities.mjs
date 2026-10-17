import { discoverNpm, currentRuntime, supportStatus, canUseToolchain } from '../../src/toolchain.mjs';
// Phase 0 qualification only: built-ins, synthetic metadata, no package downloads.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const explicit = args[0] && !args[0].startsWith('--') ? args.shift() : undefined;
if (args.length && (args.length !== 2 || args[0] !== '--experimental-macos' || args[1] !== 'true')) {
  console.error('Usage: node tests/phase0/npm-capabilities.mjs [absolute npm-cli.js path] [--experimental-macos true]');
  process.exit(4);
}
const experimentalMacos = args.length === 2;
const found = await discoverNpm({ projectRoot: root, explicit });
const npmPath = found.cli;
const npmPackage = { version: found.version };
const platformSupport = supportStatus({ ...currentRuntime(), npmVersion: found.version });
if (!canUseToolchain({ supportStatus: platformSupport }, experimentalMacos)) {
  console.error('Unsupported runtime or missing --experimental-macos true'); process.exit(2);
}

const runs = join(root, '.phase0-runs');
await mkdir(runs, { recursive: true });
const runRoot = await mkdtemp(join(runs, 'npm-'));
const userConfig = join(runRoot, 'empty-user.npmrc');
const globalConfig = join(runRoot, 'empty-global.npmrc');
await writeFile(userConfig, '');
await writeFile(globalConfig, '');
const env = {
  PATH: dirname(process.execPath),
  SystemRoot: process.env.SystemRoot,
  ComSpec: process.env.ComSpec,
  TEMP: runRoot, TMP: runRoot, HOME: runRoot, USERPROFILE: runRoot,
};
for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
const startedAt = new Date().toISOString();
const epoch = Date.now();
const oldTime = new Date(epoch - 30 * 86400000).toISOString();
const newTime = new Date(epoch - 3600000).toISOString();
const cutoff = new Date(epoch - 7 * 86400000).toISOString();
const requests = [];
let origin;
const server = createServer((req, res) => {
  requests.push({ method: req.method, path: req.url });
  const name = req.url?.slice(1);
  if (req.method !== 'GET' || !['hardhat-phase0-leaf', 'hardhat-phase0-parent'].includes(name)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only synthetic metadata endpoints exist' }));
    return;
  }
  const versions = name.endsWith('leaf') ? ['1.0.0', '1.0.1'] : ['1.0.0'];
  const manifests = Object.fromEntries(versions.map(version => [version, {
    name, version,
    ...(name.endsWith('parent') ? { dependencies: { 'hardhat-phase0-leaf': '^1.0.0' } } : {}),
    dist: { tarball: `${origin}/${name}/-/${name}-${version}.tgz`,
      integrity: `sha512-${Buffer.alloc(64).toString('base64')}` },
  }]));
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ name, 'dist-tags': { latest: versions.at(-1) }, versions: manifests,
    time: { created: oldTime, modified: newTime, '1.0.0': oldTime,
      ...(name.endsWith('leaf') ? { '1.0.1': newTime } : {}) } }));
});
await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
const exists = async path => access(path).then(() => true, () => false);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const flags = [
  `--userconfig=${userConfig}`, `--globalconfig=${globalConfig}`,
  `--registry=${origin}`, '--audit=false', '--fund=false', '--update-notifier=false',
  '--fetch-retries=0', '--fetch-timeout=5000',
];
async function npm(cwd, args, extraEnv = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [npmPath, ...args, ...flags, `--cache=${join(cwd, '.cache')}`], {
      cwd, env: { ...env, ...extraEnv }, shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', error => { clearTimeout(timer); fail(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr }); });
  });
}
async function fixture(name, dependencies = {}) {
  const cwd = join(runRoot, name);
  await mkdir(cwd);
  await writeFile(join(cwd, 'package.json'), JSON.stringify({
    name: 'hardhat-phase0-root', version: '1.0.0', private: true, dependencies,
    scripts: { preinstall: 'node canary.cjs', install: 'node canary.cjs',
      postinstall: 'node canary.cjs', prepare: 'node canary.cjs', probe: 'node canary.cjs' },
  }, null, 2));
  await writeFile(join(cwd, 'canary.cjs'), "require('node:fs').writeFileSync('CANARY_EXECUTED', 'controlled phase0 fixture');\n");
  return cwd;
}
const lock = async cwd => JSON.parse(await readFile(join(cwd, 'package-lock.json'), 'utf8'));
const selected = async cwd => (await lock(cwd)).packages['node_modules/hardhat-phase0-leaf'].version;
async function resolveFixture(cwd, extra = []) {
  const before = digest(await readFile(join(cwd, 'package.json')));
  const outcome = await npm(cwd, ['install', '--package-lock-only', '--ignore-scripts', ...extra]);
  assert.equal(digest(await readFile(join(cwd, 'package.json'))), before, 'Manifest mutated');
  assert.equal(await exists(join(cwd, 'CANARY_EXECUTED')), false, 'Lifecycle script executed');
  assert.equal(await exists(join(cwd, 'node_modules')), false, 'node_modules unexpectedly created');
  return outcome;
}
async function test(name, operation) {
  try { results.push({ name, status: 'passed', observations: await operation() }); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); }
}

try {
  await test('trusted npm entrypoint reports expected version', async () => {
    const r = await npm(runRoot, ['--version']);
    assert.equal(r.code, 0); assert.equal(r.stdout.trim(), npmPackage.version);
    return { version: r.stdout.trim() };
  });
  await test('unfiltered control selects fresh leaf; v3 lock; no lifecycle execution', async () => {
    const cwd = await fixture('unfiltered', { 'hardhat-phase0-leaf': '^1.0.0' });
    const r = await resolveFixture(cwd); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.1'); assert.equal((await lock(cwd)).lockfileVersion, 3);
    return { selected: await selected(cwd), lockfileVersion: 3 };
  });
  await test('seven-day cooldown filters direct fresh release', async () => {
    const cwd = await fixture('cooldown', { 'hardhat-phase0-leaf': '^1.0.0' });
    const r = await resolveFixture(cwd, ['--min-release-age=7']); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.0'); return { selected: await selected(cwd) };
  });
  await test('seven-day cooldown filters fresh transitive release', async () => {
    const cwd = await fixture('transitive', { 'hardhat-phase0-parent': '1.0.0' });
    const r = await resolveFixture(cwd, ['--min-release-age=7']); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.0'); return { selected: await selected(cwd) };
  });
  await test('absolute cutoff filters fresh release', async () => {
    const cwd = await fixture('before', { 'hardhat-phase0-leaf': '^1.0.0' });
    const r = await resolveFixture(cwd, [`--before=${cutoff}`]); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.0'); return { selected: await selected(cwd) };
  });
  await test('fresh exact version is rejected by cooldown', async () => {
    const cwd = await fixture('exact', { 'hardhat-phase0-leaf': '1.0.1' });
    const r = await resolveFixture(cwd, ['--min-release-age=7']);
    assert.notEqual(r.code, 0); assert.match(r.stderr, /ETARGET/);
    return { exitCode: r.code, errorCode: 'ETARGET' };
  });
  await test('record existing-lock cooldown behavior', async () => {
    const cwd = await fixture('existing', { 'hardhat-phase0-leaf': '^1.0.0' });
    const a = await resolveFixture(cwd); assert.equal(a.code, 0, a.stderr);
    assert.equal(await selected(cwd), '1.0.1');
    const b = await resolveFixture(cwd, ['--min-release-age=7']); assert.equal(b.code, 0, b.stderr);
    return { selectedAfterCooldown: await selected(cwd), note: 'Observation, not an age-enforcement assertion' };
  });
  await test('CLI script suppression overrides false environment setting', async () => {
    const cwd = await fixture('precedence');
    const r = await npm(cwd, ['config', 'get', 'ignore-scripts', '--ignore-scripts'], { npm_config_ignore_scripts: 'false' });
    assert.equal(r.code, 0, r.stderr); assert.equal(r.stdout.trim(), 'true');
    return { effectiveIgnoreScripts: true };
  });
  await test('same-source before overrides min-release-age', async () => {
    const cwd = await fixture('both', { 'hardhat-phase0-leaf': '^1.0.0' });
    const r = await resolveFixture(cwd, [`--before=${new Date(epoch).toISOString()}`, '--min-release-age=7']);
    assert.equal(r.code, 0, r.stderr); assert.equal(await selected(cwd), '1.0.1');
    return { exitCode: r.code, selected: await selected(cwd) };
  });
  await test('project npmrc cooldown applies during resolution', async () => {
    const cwd = await fixture('project-setting', { 'hardhat-phase0-leaf': '^1.0.0' });
    await writeFile(join(cwd, '.npmrc'), 'min-release-age=7\n');
    const r = await resolveFixture(cwd); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.0'); return { selected: await selected(cwd) };
  });
  await test('CLI zero cooldown overrides project protection', async () => {
    const cwd = await fixture('cli-override', { 'hardhat-phase0-leaf': '^1.0.0' });
    await writeFile(join(cwd, '.npmrc'), 'min-release-age=7\n');
    const r = await resolveFixture(cwd, ['--min-release-age=0']); assert.equal(r.code, 0, r.stderr);
    assert.equal(await selected(cwd), '1.0.1'); return { selected: await selected(cwd) };
  });
  await test('package exclusion bypasses cooldown', async () => {
    const cwd = await fixture('excluded', { 'hardhat-phase0-leaf': '^1.0.0' });
    const r = await resolveFixture(cwd, ['--min-release-age=7', '--min-release-age-exclude=hardhat-phase0-leaf']);
    assert.equal(r.code, 0, r.stderr); assert.equal(await selected(cwd), '1.0.1');
    return { selected: await selected(cwd) };
  });
  await test('positive canary: explicit npm run still executes with ignore-scripts', async () => {
    const cwd = await fixture('positive-canary');
    const r = await npm(cwd, ['run', 'probe', '--ignore-scripts']); assert.equal(r.code, 0, r.stderr);
    assert.equal(await exists(join(cwd, 'CANARY_EXECUTED')), true);
    return { explicitlyRequestedFixtureScriptExecuted: true };
  });
  await test('fixture registry received metadata requests only', async () => {
    assert.ok(requests.length > 0);
    assert.ok(requests.every(r => r.method === 'GET' && /^\/hardhat-phase0-(leaf|parent)$/.test(r.path)));
    return { requestCount: requests.length, tarballRequests: 0 };
  });
} finally {
  await new Promise(done => server.close(done));
}
const report = {
  kind: 'phase0-qualification', supportStatus: platformSupport, experimentalMacos, startedAt, completedAt: new Date().toISOString(),
  runtime: { node: process.version, npm: npmPackage.version, platform: process.platform, arch: process.arch, osRelease: os.release() },
  executableEvidence: { node: process.execPath, npmCli: npmPath,
    npmCliSha256: digest(await readFile(npmPath)), harnessSha256: digest(await readFile(fileURLToPath(import.meta.url))) },
  fixture: { oldTime, newTime, cutoff, origin, runRoot }, results,
  limitations: ['No package artifacts downloaded or installed', 'No dependency-level lifecycle canary',
    'No production resolver, policy evaluator, scanner, or installation gate',
    'Existing-lock case records behavior without asserting age enforcement',
    'Loopback-only synthetic data; not proof of OS network isolation'],
};
await mkdir(join(root, 'docs/evidence'), { recursive: true });
const reportPath = join(root, `docs/evidence/npm-capabilities-${process.platform}-${process.arch}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportPath, passed: results.filter(r => r.status === 'passed').length,
  failed: results.filter(r => r.status === 'failed'), observations: results.filter(r => r.name.startsWith('record')) }, null, 2));
process.exitCode = results.some(r => r.status === 'failed') ? 1 : 0;
