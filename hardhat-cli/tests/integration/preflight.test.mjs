import { npmCli, experimentalMacos, macArgs } from '../runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { preflight } from '../../src/adapters/npm/preflight.mjs';
import { validate } from '../../src/evidence/validate.mjs';
import { preflightSchema } from '../../schemas/preflight.mjs';
import { checkSchema } from '../../schemas/v1.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');


async function fixture({ npmrc = 'min-release-age=7\nignore-scripts=true\n', manifest = {}, global = '', user = '' } = {}) {
  const base = await mkdtemp(join(os.tmpdir(), 'hardhat-preflight-'));
  const project = join(base, 'project'); await mkdir(project);
  const pkg = { name: 'hardhat-preflight-fixture', version: '1.0.0', packageManager: 'npm@11.19.1',
    scripts: { preinstall: 'node canary.cjs', install: 'node canary.cjs', prepare: 'node canary.cjs' }, ...manifest };
  await writeFile(join(project, 'package.json'), JSON.stringify(pkg));
  await writeFile(join(project, 'package-lock.json'), JSON.stringify({ name: pkg.name, version: pkg.version,
    lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version } } }));
  await writeFile(join(project, '.npmrc'), npmrc);
  await writeFile(join(project, 'canary.cjs'), "require('node:fs').writeFileSync('SCRIPT_EXECUTED', 'bad');");
  await writeFile(join(base, 'user.npmrc'), user); await writeFile(join(base, 'global.npmrc'), global);
  const environment = { HOME: base, USERPROFILE: base,
    npm_config_userconfig: join(base, 'user.npmrc'), npm_config_globalconfig: join(base, 'global.npmrc') };
  return { base, project, environment, npmCli };
}
const inspect = async (f, extra = {}) => preflight({ experimentalMacos, project: f.project, environment: f.environment, npmCli: f.npmCli, ...extra });
const code = (r, c) => r.issues.some(i => i.code === c);
const setting = (r, key) => r.settings.find(s => s.key === key);
async function snapshot(path) {
  const files = {};
  async function visit(folder) {
    for (const ent of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, ent.name);
      if (ent.isDirectory()) await visit(file);
      else files[file] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  await visit(path); return files;
}

test('live inspection reads project settings, schema-valid partial checks, no file writes or scripts', async () => {
  const f = await fixture(); const before = await snapshot(f.base); const r = await inspect(f);
  assert.equal(r.status, 'complete', JSON.stringify(r.issues)); validate(preflightSchema, r);
  assert.equal(r.mode, 'live-preflight'); assert.equal(r.authorization, 'none'); assert.equal(r.protectionMode, 'native');
  assert.equal(setting(r, 'min-release-age').source, 'project'); assert.equal(setting(r, 'min-release-age').value, '7');
  assert.equal(setting(r, 'ignore-scripts').value, 'true');
  assert.deepEqual(r.checks.map(c => c.category), ['context', 'protections']); r.checks.forEach(c => validate(checkSchema, c));
  assert.deepEqual(await snapshot(f.base), before); assert.equal(Object.hasOwn(r, 'decision'), false);
});
test('missing cooldown and unsuppressed scripts require manual review', async () => {
  const r = await inspect(await fixture({ npmrc: '' }));
  assert.equal(r.status, 'review'); assert.equal(r.protectionMode, 'manual-required');
  assert.ok(code(r, 'COOLDOWN_INACTIVE_OR_WEAK')); assert.ok(code(r, 'SCRIPTS_NOT_SUPPRESSED'));
});
test('native precedence: project over user/global, environment over project, CLI over environment', async () => {
  const f = await fixture({ global: 'min-release-age=30\n', user: 'min-release-age=14\n' });
  assert.equal(setting(await inspect(f), 'min-release-age').value, '7');
  f.environment.npm_config_min_release_age = '0';
  let r = await inspect(f); assert.equal(setting(r, 'min-release-age').source, 'env'); assert.equal(r.protectionMode, 'manual-required');
  r = await inspect(f, { npmFlags: ['--min-release-age=14'] });
  assert.equal(r.cutoff.source, 'cli'); assert.equal(r.cutoff.meetsSevenDayPolicy, true);
  assert.equal(setting(r, 'min-release-age').value, '14');
});
test('before wins within source and a higher-priority age wins over project before', async () => {
  const f = await fixture({ npmrc: 'min-release-age=7\nbefore=2000-01-01T00:00:00Z\nignore-scripts=true\n' });
  let r = await inspect(f); assert.equal(r.cutoff.effectiveBefore, '2000-01-01T00:00:00.000Z');
  r = await inspect(f, { npmFlags: ['--min-release-age=0'] });
  assert.equal(r.cutoff.source, 'cli'); assert.equal(r.cutoff.meetsSevenDayPolicy, false);
});
test('newer absolute CLI cutoff overrides relative cooldown and is reported weak', async () => {
  const f = await fixture(); const r = await inspect(f, { npmFlags: ['--min-release-age=7', '--before=2099-01-01T00:00:00Z'] });
  assert.equal(r.cutoff.effectiveBefore, '2099-01-01T00:00:00.000Z'); assert.equal(r.status, 'review');
});
test('seven-day CLI cutoff cannot silently weaken a stronger project policy', async () => {
  const f = await fixture({ npmrc: 'min-release-age=30\nignore-scripts=true\n' });
  const r = await inspect(f, { npmFlags: ['--min-release-age=7'] });
  assert.equal(r.cutoff.meetsSevenDayPolicy, true); assert.equal(r.status, 'review');
  assert.ok(code(r, 'STRONGER_CUTOFF_OVERRIDDEN'));
});
test('package exceptions are disclosed without dumping package patterns', async () => {
  const f = await fixture({ npmrc: 'min-release-age=7\nignore-scripts=true\nmin-release-age-exclude[]=@private/*\n' });
  const r = await inspect(f); assert.ok(code(r, 'COOLDOWN_EXCLUSIONS'));
  assert.equal(r.cutoff.exclusionsPresent, true); assert.doesNotMatch(JSON.stringify(r), /@private/);
});
test('unknown npm protection key and wrong-manager config cannot claim active protection', async () => {
  const f = await fixture({ npmrc: 'minimumReleaseAge=10080\nignore-scripts=true\n' });
  let r = await inspect(f); assert.ok(code(r, 'UNKNOWN_NPM_CONFIG')); assert.ok(code(r, 'COOLDOWN_INACTIVE_OR_WEAK'));
  await writeFile(join(f.project, '.yarnrc.yml'), 'npmMinimalAgeGate: 7d\n');
  r = await inspect(f); assert.ok(code(r, 'OTHER_MANAGER_PROTECTION_FILE'));
});
test('unsupported option is refused as data, never executed', async () => {
  const r = await inspect(await fixture(), { npmFlags: ['--made-up-age=7'] });
  assert.ok(code(r, 'UNSUPPORTED_NPM_OPTION')); assert.equal(r.settings.length, 0); assert.equal(r.status, 'review');
});
test('invalid setting does not silently revert to a successful default', async () => {
  const r = await inspect(await fixture({ npmrc: 'min-release-age=bad\nignore-scripts=true\n' }));
  assert.equal(r.status, 'review'); assert.ok(code(r, 'INVALID_NPM_CONFIG') || code(r, 'NPM_CONFIG_WARNING'));
});
test('global environment scope cannot silently ignore project protection', async () => {
  const f = await fixture(); f.environment.npm_config_global = 'true';
  const r = await inspect(f); assert.equal(r.status, 'unsupported'); assert.ok(code(r, 'CONFIG_SCOPE_MISMATCH'));
});
test('environment substitutions use npm native parsing without exposing raw values', async () => {
  const f = await fixture({ npmrc: 'min-release-age=${HARDHAT_FIXTURE_DAYS}\nignore-scripts=true\n' });
  f.environment.HARDHAT_FIXTURE_DAYS = '14';
  const r = await inspect(f); assert.equal(r.status, 'complete'); assert.equal(setting(r, 'min-release-age').value, '14');
});
test('alternate managers and conflicting lockfiles never invoke project tools', async () => {
  const f = await fixture({ manifest: { packageManager: 'pnpm@10.0.0' } });
  let r = await inspect(f); assert.equal(r.status, 'unsupported'); assert.ok(code(r, 'MANAGER_CONFLICT')); assert.equal(r.settings.length, 0);
  const g = await fixture(); await writeFile(join(g.project, 'yarn.lock'), '# fixture');
  r = await inspect(g); assert.ok(code(r, 'MANAGER_CONFLICT'));
});
test('CI and explicit project instructions corroborate manager conflicts without execution', async () => {
  const f = await fixture(); await mkdir(join(f.project, '.github/workflows'), { recursive: true });
  await writeFile(join(f.project, '.github/workflows/ci.yml'), 'steps:\n  - run: pnpm install\n');
  const r = await inspect(f); assert.ok(code(r, 'MANAGER_CONFLICT'));
  assert.ok(r.managerSignals.some(s => s.source === 'CI workflow hint'));
});
test('workspaces, wrong lock versions and declared versions are unsupported', async () => {
  const f = await fixture({ manifest: { workspaces: ['packages/*'] } }); assert.ok(code(await inspect(f), 'UNSUPPORTED_WORKSPACE'));
  const g = await fixture(); await writeFile(join(g.project, 'package-lock.json'), '{"lockfileVersion":2}');
  assert.ok(code(await inspect(g), 'UNSUPPORTED_LOCKFILE'));
  const h = await fixture({ manifest: { packageManager: 'npm@11.12.1' } }); assert.ok(code(await inspect(h), 'DECLARED_VERSION_MISMATCH'));
});
test('v3 label without root lock data cannot pass context checks', async () => {
  const f = await fixture(); await writeFile(join(f.project, 'package-lock.json'), '{"lockfileVersion":3}');
  const r = await inspect(f); assert.equal(r.status, 'unsupported'); assert.ok(code(r, 'UNSUPPORTED_LOCKFILE'));
});
test('project-controlled npm entrypoint is refused before loading its code', async () => {
  const f = await fixture(); const fakeRoot = join(f.project, 'node_modules/npm'); await mkdir(join(fakeRoot, 'bin'), { recursive: true });
  await writeFile(join(fakeRoot, 'package.json'), '{"name":"npm","version":"11.19.1"}');
  await writeFile(join(fakeRoot, 'bin/npm-cli.js'), 'throw new Error("UNTRUSTED_EXECUTED")');
  const r = await inspect(f, { npmCli: join(fakeRoot, 'bin/npm-cli.js') });
  assert.ok(code(r, 'TRUSTED_NPM_UNAVAILABLE')); assert.equal(r.settings.length, 0);
});
test('registry credentials, tokens, private URLs and raw warnings never enter report', async () => {
  const secret = 'SECRETSENTINEL_123';
  const f = await fixture({ npmrc: `min-release-age=7\nignore-scripts=true\n//registry.npmjs.org/:_authToken=${secret}\n@private:registry=https://user:${secret}@private.invalid/api/?token=${secret}\n` });
  const before = await snapshot(f.base); const r = await inspect(f);
  assert.ok(code(r, 'UNSUPPORTED_REGISTRY')); assert.doesNotMatch(JSON.stringify(r), /SECRETSENTINEL|private\.invalid|@private|_authToken/);
  assert.deepEqual(await snapshot(f.base), before);
});
test('invalid auth diagnostics are sanitized and user config is not repaired', async () => {
  const f = await fixture({ user: '_authToken=SECRETSENTINEL_ABC\n' }); const before = await snapshot(f.base);
  const r = await inspect(f); assert.equal(r.status, 'review'); assert.doesNotMatch(JSON.stringify(r), /SECRETSENTINEL/);
  assert.deepEqual(await snapshot(f.base), before);
});
test('NODE_OPTIONS supplied as config environment cannot load code in probe child', async () => {
  const f = await fixture(); const canary = join(f.base, 'startup.cjs');
  await writeFile(canary, `require('node:fs').writeFileSync(${JSON.stringify(join(f.base, 'STARTUP_EXECUTED'))}, 'bad')`);
  f.environment.NODE_OPTIONS = `--require=${canary}`;
  const r = await inspect(f); assert.equal(r.status, 'complete');
  await assert.rejects(access(join(f.base, 'STARTUP_EXECUTED')));
});
test('locked installs and runners explicitly require checks beyond native cooldown', async () => {
  const f = await fixture();
  for (const operation of ['locked-install', 'runner']) {
    const r = await inspect(f, { operation }); assert.equal(r.status, 'review'); assert.equal(r.protectionMode, 'manual-required');
    assert.ok(code(r, 'OPERATION_REQUIRES_MANUAL_CHECKS'));
  }
});
test('unsafe TLS, disabled lockfile and blanket script bypass are reported', async () => {
  const r = await inspect(await fixture(), { npmFlags: ['--strict-ssl=false', '--package-lock=false', '--dangerously-allow-all-scripts=true'] });
  for (const c of ['TLS_VERIFICATION_DISABLED', 'LOCKFILE_DISABLED', 'SCRIPT_BYPASS_ENABLED']) assert.ok(code(r, c));
});
test('CLI project inspection and proposed flags emit preflight JSON with expected exit codes', async () => {
  const f = await fixture({ npmrc: '' }); const flags = join(f.base, 'options.json');
  await writeFile(flags, JSON.stringify(['--min-release-age=7', '--ignore-scripts=true']));
  const invoke = extra => spawnSync(process.execPath, [join(root, 'src/cli.mjs'), 'inspect', '--project', f.project, '--npm-cli', npmCli, ...macArgs, ...extra], {
    encoding: 'utf8', timeout: 15000, windowsHide: true, env: { ...process.env, ...f.environment },
  });
  let p = invoke([]); assert.equal(p.status, 2, p.stderr); assert.equal(JSON.parse(p.stdout).kind, 'preflight-report');
  p = invoke(['--npm-options', flags]); assert.equal(p.status, 0, p.stderr); assert.equal(JSON.parse(p.stdout).status, 'complete');
  assert.equal(p.stderr, '');
  p = invoke(['--at', '2026-10-16T18:00:00.000Z']); assert.equal(p.status, 4);
});
test('exported preflight schema matches source', async () => {
  assert.deepEqual(JSON.parse(await readFile(join(root, 'schemas/preflight.schema.json'), 'utf8')), preflightSchema);
});

test('experimental flag is explicit, boolean, live-only and cannot change evidence policy', async () => {
  const f = await fixture();
  const run = args => spawnSync(process.execPath, [join(root, 'src/cli.mjs'), ...args], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, ...f.environment }, timeout: 15000,
  });
  const live = ['inspect', '--project', f.project, '--npm-cli', npmCli];
  const valid = run([...live, '--experimental-macos', 'true']);
  assert.equal(valid.status, 0, valid.stderr);
  const result = JSON.parse(valid.stdout);
  assert.equal(result.schemaVersion, '1.1.0');
  assert.equal(result.toolchain.supportStatus, process.platform === 'darwin' ? 'experimental' : 'validated');
  assert.equal(result.toolchain.qualified, process.platform !== 'darwin');
  for (const args of [
    [...live, '--experimental-macos', 'yes'], [...live, '--experimental-macos'],
    [...live, '--experimental-macos', 'true', '--experimental-macos', 'true'],
    ['review', '--evidence', 'tests/fixtures/pass.json', '--experimental-macos', 'true'],
    ['inspect', '--evidence', 'tests/fixtures/pass.json', '--experimental-macos', 'false'],
    ['check', '--project', f.project, '--public-package', 'demo', '--version', '1.0.0', '--experimental-macos', 'yes'],
  ]) assert.equal(run(args).status, 4, JSON.stringify(args));
  if (process.platform === 'darwin') {
    const gated = run(live);
    assert.equal(gated.status, 2);
    assert.ok(JSON.parse(gated.stdout).issues.some(i => i.code === 'MACOS_OPT_IN_REQUIRED'));
  }
});
