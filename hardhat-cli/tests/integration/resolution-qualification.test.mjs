import { npmCli, experimentalMacos, macArgs } from '../runtime.mjs';
// Synthetic qualification only. This does not enable production candidate resolution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, access, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const exists = path => access(path).then(() => true, () => false);
function run(args, cwd, env) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; const timer = setTimeout(() => child.kill(), 20000);
    const collect = bytes => { output += bytes; if (output.length > 1024 * 1024) child.kill(); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); done({ code, output }); });
  });
}
test('qualified npm lockfile-only operation suppresses root and advertised dependency lifecycle canaries', async t => {

  const base = await mkdtemp(join(tmpdir(), 'hardhat-resolver-qualification-')), proposal = join(base, 'proposal'); await mkdir(proposal);
  const canary = "require('node:fs').writeFileSync('DEPENDENCY_EXECUTED', 'canary')";
  await writeFile(join(base, 'canary.cjs'), canary);
  const env = { PATH: dirname(process.execPath), SystemRoot: process.env.SystemRoot, ComSpec: process.env.ComSpec,
    HOME: base, USERPROFILE: base, TEMP: base, TMP: base };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const positive = await run([join(base, 'canary.cjs')], base, env);
  assert.equal(positive.code, 0); assert.equal(await exists(join(base, 'DEPENDENCY_EXECUTED')), true);
  await writeFile(join(proposal, 'canary.cjs'), canary);
  const scripts = { preinstall: 'node canary.cjs', install: 'node canary.cjs', postinstall: 'node canary.cjs', prepare: 'node canary.cjs' };
  await writeFile(join(proposal, 'package.json'), JSON.stringify({ name: 'qualification-root', version: '1.0.0', dependencies: { 'qualification-dependency': '1.0.0' }, scripts }));
  await writeFile(join(base, 'user.npmrc'), ''); await writeFile(join(base, 'global.npmrc'), '');
  const before = await readFile(join(proposal, 'package.json')); const requests = []; let origin;
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (req.url !== '/qualification-dependency') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ name: 'qualification-dependency', 'dist-tags': { latest: '1.0.0' },
      time: { '1.0.0': new Date(Date.now() - 30 * 86400000).toISOString() },
      versions: { '1.0.0': { name: 'qualification-dependency', version: '1.0.0', scripts,
        dist: { tarball: `${origin}/qualification-dependency/-/package.tgz`, integrity: `sha512-${Buffer.alloc(64).toString('base64')}` } } } }));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); return new Promise(done => server.close(done)); });
  const result = await run([npmCli, 'install', '--package-lock-only', '--ignore-scripts=true', '--min-release-age=7',
    '--allow-git=none', '--allow-remote=none', '--allow-directory=none', '--allow-file=none',
    '--audit=false', '--fund=false', '--update-notifier=false', '--fetch-retries=0', '--fetch-timeout=5000',
    `--registry=${origin}`, `--userconfig=${join(base, 'user.npmrc')}`, `--globalconfig=${join(base, 'global.npmrc')}`,
    `--cache=${join(base, 'cache')}`], proposal, env);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(await readFile(join(proposal, 'package.json')), before);
  assert.equal(await exists(join(proposal, 'DEPENDENCY_EXECUTED')), false); assert.equal(await exists(join(proposal, 'node_modules')), false);
  assert.ok(requests.length > 0); assert.ok(requests.every(path => path === '/qualification-dependency'));
  const lock = JSON.parse(await readFile(join(proposal, 'package-lock.json')));
  assert.equal(lock.packages['node_modules/qualification-dependency'].hasInstallScript, true);
  assert.equal(await readFile(join(base, 'user.npmrc'), 'utf8'), ''); assert.equal(await readFile(join(base, 'global.npmrc'), 'utf8'), '');
});
