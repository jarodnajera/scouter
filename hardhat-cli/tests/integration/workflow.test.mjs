import { npmCli, experimentalMacos, macArgs } from '../runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, chmod, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dependencyWorkflow, findFirewall, runFirewall } from '../../src/workflow.mjs';
import { renderText } from '../../src/report/render.mjs';
async function fixture(patch = {}) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'hardhat-workflow-'))), project = join(base, 'project'); await mkdir(project);
  const manifest = { name: 'root', version: '1.0.0', packageManager: 'npm@11.19.1' };
  await writeFile(join(project, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': manifest } }));
  await writeFile(join(project, '.npmrc'), ''); await writeFile(join(base, 'user.npmrc'), ''); await writeFile(join(base, 'global.npmrc'), '');
  const sfw = join(base, process.platform === 'win32' ? 'sfw.exe' : 'sfw'); await writeFile(sfw, 'author-written fake tool; never execute'); await chmod(sfw, 0o700);
  const calls = [];
  const args = { project, sfw, npmCli, experimentalMacos, publicPackage: 'demo', version: '1.0.0',
    environment: { HOME: base, USERPROFILE: base, npm_config_userconfig: join(base, 'user.npmrc'), npm_config_globalconfig: join(base, 'global.npmrc') },
    client: async () => ({ source: 'https://registry.npmjs.org/demo', attempts: 1, document: {
      name: 'demo', time: { '1.0.0': '2020-01-01T00:00:00Z' }, versions: { '1.0.0': { name: 'demo', version: '1.0.0',
        dist: { tarball: 'https://registry.npmjs.org/demo/-/demo-1.0.0.tgz', integrity: `sha512-${Buffer.alloc(64).toString('base64')}` }, ...patch } } } }),
    runner: async (...args) => {
      calls.push(args);
      const field = args[1].includes('--save-dev') ? 'devDependencies' : 'dependencies';
      const installed = { ...manifest, [field]: { demo: '1.0.0' } };
      await writeFile(join(project, 'package.json'), JSON.stringify(installed));
      await writeFile(join(project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': installed,
        'node_modules/demo': { version: '1.0.0', integrity: `sha512-${Buffer.alloc(64).toString('base64')}` } } }));
      return { code: 0, stopped: false, stdout: 'allowed; not a security audit', stderr: '' };
    } };
  return { args, calls, base };
}
test('simple check is read-only and old stable release is eligible without a full audit API', async () => {
  const f = await fixture(); const before = await readFile(join(f.args.project, 'package.json'));
  const r = await dependencyWorkflow(f.args); assert.equal(r.status, 'ready', JSON.stringify(r.issues));
  assert.deepEqual(f.calls, []); assert.deepEqual(await readFile(join(f.args.project, 'package.json')), before);
  assert.equal(r.authorization, 'none'); assert.ok(!renderText(r).includes('Decision: PASS'));
});
test('install invokes firewall only, pins version, suppresses scripts, uses fresh cache and keeps audit separate', async () => {
  const f = await fixture(); const r = await dependencyWorkflow({ ...f.args, install: true, dev: true });
  assert.equal(r.status, 'completed', JSON.stringify(r.issues)); assert.equal(f.calls.length, 1);
  const [exe, args, cwd] = f.calls[0]; assert.equal(exe, f.args.sfw); assert.equal(cwd, f.args.project);
  for (const flag of ['demo@1.0.0', '--save-exact', '--save-dev', '--ignore-scripts=true', '--audit=false', '--allow-git=none']) assert.ok(args.includes(flag));
  assert.ok(args.some(a => a.startsWith('--cache='))); assert.ok(args.some(a => a.startsWith('--before=')));
});
test('missing firewall never falls back to npm', async () => {
  const f = await fixture(); const r = await dependencyWorkflow({ ...f.args, sfw: join(f.base, 'missing.exe'), install: true });
  assert.equal(r.status, 'review'); assert.ok(r.issues.includes('SFW_SETUP_REQUIRED')); assert.deepEqual(f.calls, []);
});

async function optionalBundleProject(f, cpu = ['wasm32']) {
  const manifest = JSON.parse(await readFile(join(f.args.project, 'package.json')));
  manifest.optionalDependencies = { 'optional-wasm': '1.0.0' };
  await writeFile(join(f.args.project, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(f.args.project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    '': manifest,
    'node_modules/optional-wasm': { version: '1.0.0', optional: true, cpu,
      resolved: 'https://registry.npmjs.org/optional-wasm/-/optional-wasm-1.0.0.tgz',
      integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
      dependencies: { 'bundled-child': '^1' }, bundleDependencies: ['bundled-child'] },
  } }));
}

test('check and controlled install disclose excluded optional bundles without blocking', async () => {
  const f = await fixture(); await optionalBundleProject(f);
  const check = await dependencyWorkflow(f.args);
  assert.equal(check.status, 'ready', JSON.stringify(check.issues));
  assert.ok(check.limitations.some(l => l.includes('Optional bundle excluded') && l.includes('optional-wasm')));
  assert.match(renderText(check), /Bundled contents were not reviewed/);
  assert.deepEqual(f.calls, []);
  const installed = await dependencyWorkflow({ ...f.args, install: true });
  assert.equal(installed.status, 'completed'); assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0][1].includes('--ignore-scripts=true'));
});

test('applicable optional bundles stop before invoking the firewall', async () => {
  const f = await fixture(); await optionalBundleProject(f, [process.arch]);
  const r = await dependencyWorkflow({ ...f.args, install: true });
  assert.equal(r.status, 'review'); assert.ok(r.issues.includes('BUNDLED_DEPENDENCIES_UNVERIFIED'));
  assert.deepEqual(f.calls, []);
});

test('platform overrides and force cannot bypass an optional bundle exclusion', async () => {
  for (const config of ['cpu=wasm32', 'os=linux', 'libc=musl', 'force=true']) {
    const f = await fixture(); await optionalBundleProject(f);
    await writeFile(join(f.args.project, '.npmrc'), `${config}\n`);
    const r = await dependencyWorkflow({ ...f.args, install: true });
    assert.equal(r.status, 'review'); assert.deepEqual(f.calls, []);
    assert.ok(r.issues.includes(config.startsWith('force') ? 'FORCE_MODE_UNSAFE' : 'PLATFORM_OVERRIDE_UNSUPPORTED'));
  }
});
test('deprecated release and install behavior stop before any install', async () => {
  for (const patch of [{ deprecated: 'unsupported' }, { scripts: { postinstall: 'curl hostile' } }, { bin: 'cli.js' }]) {
    const f = await fixture(patch); const r = await dependencyWorkflow({ ...f.args, install: true });
    assert.equal(r.status, 'review'); assert.deepEqual(f.calls, []);
  }
});
test('fresh release and stronger existing cutoff cannot be silently bypassed', async () => {
  const f = await fixture(), client = f.args.client;
  f.args.client = async () => { const r = await client(); r.document.time['1.0.0'] = new Date(Date.now() - 3600000).toISOString(); return r; };
  let r = await dependencyWorkflow({ ...f.args, install: true }); assert.ok(r.issues.includes('AGE_TOO_RECENT')); assert.deepEqual(f.calls, []);
  f.args.client = client; await writeFile(join(f.args.project, '.npmrc'), 'before=2019-01-01T00:00:00Z\n');
  r = await dependencyWorkflow(f.args); assert.ok(r.issues.includes('PROJECT_CUTOFF_NOT_MET'));
});
test('nonzero firewall exit stops once without claiming confirmed malware or retrying npm', async () => {
  const f = await fixture(); let attempts = 0;
  const r = await dependencyWorkflow({ ...f.args, install: true, runner: async () => { attempts++; return { code: 1, stopped: false, stdout: '', stderr: 'blocked or network failure' }; } });
  assert.equal(r.status, 'stopped'); assert.equal(attempts, 1); assert.ok(r.issues.includes('SFW_OR_NPM_STOPPED'));
});
test('firewall discovery refuses project tools and Windows shell launchers', async () => {
  const f = await fixture(); const path = join(f.args.project, 'sfw.exe'); await writeFile(path, 'fake');
  assert.equal(await findFirewall(f.args.project, path), null);
  const cmd = join(f.base, 'sfw.cmd'); await writeFile(cmd, 'echo unsafe'); assert.equal(await findFirewall(f.args.project, cmd), null);
});

async function launcherFixture() {
  const f = await fixture();
  const dir = join(f.base, 'npm tools', 'node_modules', 'sfw');
  await mkdir(join(dir, 'dist'), { recursive: true });
  const entry = join(dir, 'dist', 'sfw.mjs');
  await writeFile(entry, '// controlled launcher fixture; never executed');
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'sfw', version: '2.0.6', bin: { sfw: 'dist/sfw.mjs' } }));
  const shim = join(f.base, 'npm tools', 'sfw.ps1');
  await writeFile(shim, 'throw "Shell shim must not execute"');
  return { ...f, dir, entry, shim };
}

test('npm launcher discovery and guarded install use Node directly with argument arrays', async () => {
  const f = await launcherFixture();
  const found = await findFirewall(f.args.project, f.shim);
  assert.equal(found.kind, 'npm-launcher'); assert.equal(found.path, f.entry);
  assert.equal((await findFirewall(f.args.project, f.entry)).path, f.entry);
  if (process.platform === 'win32') assert.equal((await findFirewall(f.args.project, undefined, { PATH: join(f.base, 'npm tools') })).path, f.entry);
  const r = await dependencyWorkflow({ ...f.args, sfw: f.shim, install: true });
  assert.equal(r.status, 'completed', JSON.stringify(r.issues));
  assert.equal(f.calls[0][0], process.execPath);
  assert.deepEqual(f.calls[0][1].slice(0, 2), [f.entry, process.execPath]);
  assert.ok(f.calls[0][1].includes('--ignore-scripts=true'));
});

test('npm launcher requires matching package identity and rejects project-local entries', async () => {
  const f = await launcherFixture();
  assert.equal(await findFirewall(f.base, f.shim), null);
  await writeFile(join(f.dir, 'package.json'), JSON.stringify({ name: 'other', bin: { sfw: 'dist/sfw.mjs' } }));
  assert.equal(await findFirewall(f.args.project, f.shim), null);
});

test('changed launcher identity stops before invocation', async () => {
  const f = await launcherFixture();
  const r = await dependencyWorkflow({ ...f.args, sfw: f.shim, install: true,
    locate: async (...args) => {
      const found = await findFirewall(...args);
      await writeFile(join(f.dir, 'package.json'), '{}');
      return found;
    } });
  assert.equal(r.status, 'review'); assert.ok(r.issues.includes('INPUT_OR_TOOL_CHANGED'));
  assert.deepEqual(f.calls, []);
});
test('missing registry integrity stops before install rather than discovering the gap afterward', async () => {
  const f = await fixture({ dist: { tarball: 'https://registry.npmjs.org/demo/-/demo-1.0.0.tgz' } });
  const r = await dependencyWorkflow({ ...f.args, install: true }); assert.ok(r.issues.includes('INTEGRITY_METADATA_MISSING')); assert.deepEqual(f.calls, []);
});
test('zero exit without the expected installed version/integrity is not success', async () => {
  const f = await fixture(); const r = await dependencyWorkflow({ ...f.args, install: true,
    runner: async () => ({ code: 0, stopped: false, stdout: 'internal error', stderr: '' }) });
  assert.equal(r.status, 'review'); assert.ok(r.issues.includes('INSTALL_RESULT_NOT_VERIFIED'));
});
test('runner uses arguments as data, strips injected startup flags and escapes tool output', async () => {
  const r = await runFirewall(process.execPath, ['-e', "console.log(process.env.NODE_OPTIONS || 'unset'); console.log('\\x1b[31m untrusted')"], tmpdir(), { ...process.env, NODE_OPTIONS: '--require DOES_NOT_EXIST', SFW_BYPASS: 'true' });
  assert.equal(r.code, 0); assert.ok(r.stdout.includes('unset')); assert.ok(r.stdout.includes('\u001b'));
});

test('simulated Mac runtime stops before lookup, tool discovery, and install without opt-in', async () => {
  const f = await fixture();
  const r = await dependencyWorkflow({ ...f.args, install: true, experimentalMacos: false,
    runtime: { nodeVersion: '24.22.0', platform: 'darwin', arch: 'arm64' },
    client: async () => assert.fail('No external metadata request allowed'),
    locate: async () => assert.fail('No scanner discovery allowed') });
  assert.equal(r.status, 'review'); assert.ok(r.issues.includes('MACOS_OPT_IN_REQUIRED'));
  assert.equal(r.metadata.preflight.toolchain.qualified, false); assert.deepEqual(f.calls, []);
});

test('simulated Mac opt-in preserves checks and labels ready/completed as experimental', async () => {
  for (const arch of ['arm64', 'x64']) {
    const f = await fixture();
    const opts = { ...f.args, experimentalMacos: true, runtime: { nodeVersion: '24.22.0', platform: 'darwin', arch } };
    const checked = await dependencyWorkflow(opts);
    assert.equal(checked.status, 'ready', JSON.stringify(checked.issues));
    const installed = await dependencyWorkflow({ ...opts, install: true });
    assert.equal(installed.status, 'completed', JSON.stringify(installed.issues));
    for (const report of [checked, installed]) {
      assert.equal(report.schemaVersion, '1.1.0');
      assert.equal(report.metadata.preflight.toolchain.qualified, false);
      assert.equal(report.metadata.preflight.toolchain.supportStatus, 'experimental');
      assert.match(renderText(report), /macOS validation pending/);
    }
    assert.ok(f.calls[0][1].includes('--ignore-scripts=true'));
  }
  const f = await fixture({ deprecated: 'unsupported' });
  const r = await dependencyWorkflow({ ...f.args, install: true, experimentalMacos: true,
    runtime: { nodeVersion: '24.22.0', platform: 'darwin', arch: 'arm64' } });
  assert.equal(r.status, 'review'); assert.deepEqual(f.calls, []);
});

test('Mac opt-in cannot enable unsupported versions or platforms', async () => {
  for (const runtime of [{ nodeVersion: '24.23.0', platform: 'darwin', arch: 'arm64' },
    { nodeVersion: '24.22.0', platform: 'linux', arch: 'x64' }]) {
    const f = await fixture();
    const r = await dependencyWorkflow({ ...f.args, runtime, experimentalMacos: true, install: true,
      client: async () => assert.fail('Unsupported runtime must not query registry') });
    assert.ok(r.issues.includes('UNSUPPORTED_TOOLCHAIN')); assert.deepEqual(f.calls, []);
  }
});
