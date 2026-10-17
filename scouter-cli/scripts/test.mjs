import { spawn } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import os from 'node:os';
import { currentRuntime, discoverNpm, supportStatus, canUseToolchain } from '../src/toolchain.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--experimental-macos' || args[1] !== 'true')) {
  console.error('Usage: node scripts/test.mjs [--experimental-macos true]'); process.exit(4);
}
const experimentalMacos = args.length === 2;
const found = await discoverNpm({ projectRoot: root, explicit: process.env.SCOUTER_TEST_NPM_CLI });
const runtime = { ...currentRuntime(), npmVersion: found.version };
const status = supportStatus(runtime);
if (!canUseToolchain({ supportStatus: status }, experimentalMacos)) {
  console.error('Unsupported runtime or missing --experimental-macos true.'); process.exit(2);
}
const files = (await Promise.all(['unit', 'integration'].map(async folder =>
  (await readdir(join(root, 'tests', folder))).filter(n => n.endsWith('.test.mjs')).sort().map(n => join('tests', folder, n))))).flat();
const child = spawn(process.execPath, ['--test', ...files], { cwd: root, shell: false, stdio: 'inherit',
  env: { ...process.env, SCOUTER_TEST_EXPERIMENTAL_MACOS: String(experimentalMacos), SCOUTER_TEST_NPM_CLI: found.cli } });
const code = await new Promise(resolve => { child.on('error', () => resolve(1)); child.on('close', n => resolve(n ?? 1)); });
await mkdir(join(root, '.test-results'), { recursive: true });
await writeFile(join(root, '.test-results', `${runtime.platform}-${runtime.arch}.json`), JSON.stringify({
  timestamp: new Date().toISOString(), runtime, osRelease: os.release(), supportStatus: status,
  experimentalMacos, npmCli: found.cli, exitCode: code,
  scope: 'Synthetic suite and controlled runners; no live Socket interception test. Does not promote platform support.'
}, null, 2) + '\n');
process.exitCode = code;
