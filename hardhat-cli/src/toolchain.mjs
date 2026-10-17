import { realpath, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, delimiter, isAbsolute, relative, sep } from 'node:path';
import { DEFAULT_POLICY } from './policy/default.mjs';

export const currentRuntime = () => ({ nodeVersion: process.versions.node, platform: process.platform, arch: process.arch });
export function supportStatus({ nodeVersion, npmVersion, platform, arch }) {
  if (nodeVersion !== DEFAULT_POLICY.nodeVersion || npmVersion !== DEFAULT_POLICY.npmVersion) return 'unsupported';
  if (platform === 'win32' && arch === 'x64') return 'validated';
  if (platform === 'darwin' && ['arm64', 'x64'].includes(arch)) return 'experimental';
  return 'unsupported';
}
export const canUseToolchain = (toolchain, experimentalMacos = false) =>
  toolchain.supportStatus === 'validated' || (toolchain.supportStatus === 'experimental' && experimentalMacos === true);
export const isInside = (root, path) => {
  const r = relative(root, path);
  return !r || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
};

// Read installed files only: never invoke npm, a shell shim, or an auto-download manager.
export async function discoverNpm({ projectRoot, explicit, execPath = process.execPath, environment = process.env } = {}) {
  const root = await realpath(projectRoot);
  const node = await realpath(execPath);
  if (isInside(root, node)) throw new Error('Project-controlled runtime');
  const paths = explicit ? [resolve(explicit)] : [
    join(dirname(node), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(node), '../lib/node_modules/npm/bin/npm-cli.js'),
    ...(environment.PATH ?? environment.Path ?? '').split(delimiter).filter(isAbsolute)
      .flatMap(p => [join(p, 'npm'), join(p, 'node_modules/npm/bin/npm-cli.js')]),
  ];
  for (const candidate of paths) {
    try {
      if (isInside(root, resolve(candidate))) continue;
      const cli = await realpath(candidate);
      const npmRoot = await realpath(resolve(dirname(cli), '..'));
      if (isInside(root, cli) || isInside(root, npmRoot) || cli !== join(npmRoot, 'bin', 'npm-cli.js')) continue;
      if (!(await stat(cli)).isFile()) continue;
      const pkgPath = await realpath(join(npmRoot, 'package.json'));
      if (isInside(root, pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      if (pkg.name !== 'npm' || typeof pkg.version !== 'string' || pkg.bin?.npm !== 'bin/npm-cli.js') continue;
      return { cli, npmRoot, version: pkg.version };
    } catch { /* Try the next automatic candidate; explicit paths have no fallback. */ }
  }
  throw new Error('Trusted npm unavailable');
}
