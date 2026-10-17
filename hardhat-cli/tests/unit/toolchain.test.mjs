import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, symlink, chmod } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { supportStatus, canUseToolchain, discoverNpm } from '../../src/toolchain.mjs';
import { findFirewall } from '../../src/workflow.mjs';

test('compatibility table: Mac opt-in changes eligibility, never qualification or versions', () => {
  const base = { nodeVersion: '24.22.0', npmVersion: '11.19.1' };
  for (const [platform, arch, expected] of [['win32', 'x64', 'validated'], ['darwin', 'arm64', 'experimental'],
    ['darwin', 'x64', 'experimental'], ['linux', 'x64', 'unsupported'], ['win32', 'arm64', 'unsupported']]) {
    const status = supportStatus({ ...base, platform, arch }); assert.equal(status, expected);
    assert.equal(canUseToolchain({ supportStatus: status }), expected === 'validated');
    assert.equal(canUseToolchain({ supportStatus: status }, true), expected !== 'unsupported');
  }
  for (const patch of [{ nodeVersion: '24.23.0' }, { npmVersion: '12.0.0' }]) {
    assert.equal(supportStatus({ ...base, platform: 'darwin', arch: 'arm64', ...patch }), 'unsupported');
  }
});

async function layout() {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'hardhat tools ')));
  const projectRoot = join(base, 'project'), bin = join(base, 'prefix', 'bin');
  await mkdir(projectRoot); await mkdir(bin, { recursive: true });
  const execPath = join(bin, 'node'); await writeFile(execPath, 'fixture only');
  return { base, bin, projectRoot, execPath, environment: { PATH: '' } };
}
async function npmAt(root) {
  await mkdir(join(root, 'bin'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'npm', version: '11.19.1', bin: { npm: 'bin/npm-cli.js' } }));
  const cli = join(root, 'bin', 'npm-cli.js'); await writeFile(cli, 'throw new Error("must not execute discovery fixtures")');
  return cli;
}
test('discovers Unix prefix and Windows adjacent layouts with spaces; explicit paths win', async () => {
  const f = await layout();
  const unix = await npmAt(join(f.base, 'prefix', 'lib', 'node_modules', 'npm'));
  assert.equal((await discoverNpm(f)).cli, unix);
  const adjacent = await npmAt(join(f.bin, 'node_modules', 'npm'));
  assert.equal((await discoverNpm(f)).cli, adjacent);
  assert.equal((await discoverNpm({ ...f, explicit: unix })).cli, unix);
  await assert.rejects(discoverNpm({ ...f, explicit: join(f.base, 'missing') }));
});
test('refuses project-controlled npm and runtime, invalid metadata, and shell shims', async () => {
  const f = await layout(), local = await npmAt(join(f.projectRoot, 'npm'));
  await assert.rejects(discoverNpm({ ...f, explicit: local }));
  const valid = await npmAt(join(f.base, 'external', 'npm'));
  await assert.rejects(discoverNpm({ ...f, explicit: valid, execPath: local }));
  await writeFile(join(f.base, 'external', 'npm', 'package.json'), '{"name":"imposter"}');
  await assert.rejects(discoverNpm({ ...f, explicit: valid }));
  await writeFile(join(f.bin, 'npm'), '#!/bin/sh\nexit 99');
  await assert.rejects(discoverNpm({ ...f, environment: { PATH: ['relative', f.bin].join(delimiter) } }));
});
test('PATH symlinks resolve npm and sfw entrypoints without executing them', async t => {
  const f = await layout(), cli = await npmAt(join(f.base, 'versions', 'npm'));
  try { await symlink(cli, join(f.bin, 'npm')); }
  catch (e) { if (['EPERM', 'EACCES'].includes(e.code) && process.platform === 'win32') return t.skip('Windows symlink privilege unavailable; actual Mac run must execute this case.'); throw e; }
  assert.equal((await discoverNpm({ ...f, environment: { PATH: f.bin } })).cli, cli);
  const sfwRoot = join(f.base, 'global', 'sfw'); await mkdir(join(sfwRoot, 'dist'), { recursive: true });
  await writeFile(join(sfwRoot, 'package.json'), '{"name":"sfw","bin":{"sfw":"dist/sfw.mjs"}}');
  const entry = join(sfwRoot, 'dist', 'sfw.mjs'); await writeFile(entry, 'throw new Error("not executed")');
  const link = join(f.bin, 'sfw'); await symlink(entry, link);
  assert.equal((await findFirewall(f.projectRoot, link)).kind, 'npm-launcher');
  const local = await npmAt(join(f.projectRoot, 'npm'));
  const localLink = join(f.bin, 'local-npm'); await symlink(local, localLink);
  await assert.rejects(discoverNpm({ ...f, explicit: localLink }));
});
test('POSIX native Socket requires execute permission', { skip: process.platform === 'win32' }, async () => {
  const f = await layout(), path = join(f.bin, 'sfw'); await writeFile(path, 'fixture');
  await chmod(path, 0o600); assert.equal(await findFirewall(f.projectRoot, path), null);
  await chmod(path, 0o700); assert.equal((await findFirewall(f.projectRoot, path)).path, path);
});
