import { fileURLToPath } from 'node:url';
import { currentRuntime, discoverNpm, supportStatus, canUseToolchain } from '../src/toolchain.mjs';

export const experimentalMacos = process.env.SCOUTER_TEST_EXPERIMENTAL_MACOS === 'true';
export const macArgs = experimentalMacos ? ['--experimental-macos', 'true'] : [];
const found = await discoverNpm({ projectRoot: fileURLToPath(new URL('..', import.meta.url)), explicit: process.env.SCOUTER_TEST_NPM_CLI });
export const npmCli = found.cli;
export const runtimeSupport = supportStatus({ ...currentRuntime(), npmVersion: found.version });
if (!canUseToolchain({ supportStatus: runtimeSupport }, experimentalMacos)) {
  throw new Error('Test runtime unsupported or macOS opt-in absent. Use node scripts/test.mjs --experimental-macos true on the documented Mac baseline.');
}
