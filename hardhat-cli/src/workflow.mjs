import { constants } from 'node:fs';
import { canUseToolchain, isInside } from './toolchain.mjs';
import { realpath, stat, mkdtemp, readFile, access } from 'node:fs/promises';
import { join, relative, isAbsolute, delimiter, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { reviewMetadata } from './adapters/npm/review-metadata.mjs';
import { preflight, bounded } from './adapters/npm/preflight.mjs';
import { loadSemver, normalizeGraph } from './adapters/npm/graph.mjs';
import { ValidationError } from './evidence/validate.mjs';

const inside = isInside;
const digest = bytes => bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
export async function findFirewall(projectRoot, explicit, environment = process.env) {
  projectRoot = await realpath(projectRoot);
  const paths = explicit ? [explicit] : (environment.PATH ?? environment.Path ?? '').split(delimiter)
    .filter(p => isAbsolute(p)).flatMap(p => process.platform === 'win32'
      ? [join(p, 'sfw.exe'), join(p, 'sfw.cmd'), join(p, 'sfw.ps1')]
      : [join(p, 'sfw')]);
  for (const path of paths) {
    try {
      if (!isAbsolute(path) || inside(projectRoot, path)) continue;
      const resolved = await realpath(path);
      if (inside(projectRoot, resolved)) continue;
      if (!(await stat(resolved)).isFile()) continue;
      // Resolve the installed npm package, never execute or parse a shell shim.
      const shim = /^sfw\.(cmd|ps1)$/i.test(basename(resolved));
      const entry = shim ? join(dirname(resolved), 'node_modules', 'sfw', 'dist', 'sfw.mjs') : resolved;
      if (shim || basename(resolved) === 'sfw.mjs') {
        const launcher = await realpath(entry);
        const packagePath = await realpath(join(dirname(launcher), '..', 'package.json'));
        if (inside(projectRoot, launcher) || inside(projectRoot, packagePath)) continue;
        const packageBytes = await readFile(packagePath);
        const manifest = JSON.parse(packageBytes);
        if (manifest.name !== 'sfw' || manifest.bin?.sfw !== 'dist/sfw.mjs'
          || await realpath(join(dirname(packagePath), manifest.bin.sfw)) !== launcher) continue;
        return { kind: 'npm-launcher', path: launcher, sha256: digest(await readFile(launcher)),
          packagePath, packageSha256: digest(packageBytes), version: manifest.version };
      }
      if (/\.(cmd|ps1|mjs|js)$/i.test(resolved)) continue;
      if (process.platform === 'win32' && !resolved.toLowerCase().endsWith('.exe')) continue;
      if (process.platform !== 'win32') await access(resolved, constants.X_OK);
      return { path: resolved, sha256: digest(await readFile(resolved)) };
    } catch { /* A missing or unsuitable tool is a setup issue, never an npm fallback. */ }
  }
  return null;
}
export function runFirewall(executable, args, cwd, environment) {
  return new Promise(resolve => {
    const env = Object.fromEntries(Object.entries(environment).filter(([k]) => !/^(NODE_OPTIONS|NODE_PATH|SFW_.*)$/i.test(k)));
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', size = 0, stopped = false;
    const timer = setTimeout(() => { stopped = true; child.kill(); }, 300000);
    const collect = (bytes, error) => {
      size += bytes.length;
      if (size > 1024 * 1024) { stopped = true; child.kill(); return; }
      if (error) stderr += bytes; else stdout += bytes;
    };
    child.stdout.on('data', b => collect(b, false)); child.stderr.on('data', b => collect(b, true));
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, stopped: true, stdout: '', stderr: 'Firewall could not start.' }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stopped, stdout, stderr }); });
  });
}
export async function dependencyWorkflow({ install = false, project, publicPackage, version, sfw, dev = false,
  npmCli, environment = process.env, experimentalMacos = false, runtime, client, runner = runFirewall, locate = findFirewall } = {}) {
  if (typeof dev !== 'boolean') throw new ValidationError('dev must be boolean');
  const metadata = await reviewMetadata({ project, publicPackage, version, npmCli, environment, experimentalMacos, runtime, client });
  const root = metadata.preflight.projectRoot;
  const report = { kind: 'dependency-workflow-report', schemaVersion: '1.1.0', mode: install ? 'install' : 'check',
    status: 'review', authorization: 'none', requested: { name: publicPackage, version, dev }, issues: [],
    firewall: metadata.preflight.status === 'unsupported' ? null : await locate(root, sfw, environment), command: null, execution: null, metadata,
    limitations: [...(metadata.preflight.toolchain.supportStatus === 'experimental' ? ['Experimental macOS execution: not validated on this architecture.'] : []), 'READY means eligible for a guarded install attempt, not a security audit or proof of safety.',
      'Socket Firewall Free blocks confirmed malware downloads; unknown packages and AI warnings can be allowed. Cached or already installed packages may not be checked.',
      'Socket collects telemetry. Only public npm projects are supported.',
      'Install changes the real project. Scripts are disabled, but this is not an OS sandbox or mandatory gate.',
      'Review firewall output before executing new code; run your normal security audit separately.'] };
  const issue = code => { if (!report.issues.includes(code)) report.issues.push(code); };
  if (!report.firewall) issue('SFW_SETUP_REQUIRED');
  if (!metadata.candidate || metadata.status !== 'complete') issue('METADATA_INCOMPLETE');
  const claimedIntegrity = metadata.candidate?.claims.integrity;
  if (!claimedIntegrity || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(JSON.parse(claimedIntegrity))) issue('INTEGRITY_METADATA_MISSING');
  const informational = new Set(['SUPPORT_UNKNOWN', 'WITHDRAWAL_STATUS_UNKNOWN', 'IDENTITY_UNCORROBORATED', 'PROVENANCE_UNVERIFIED', 'ARTIFACT_INTEGRITY_UNVERIFIED']);
  for (const code of metadata.candidate?.issues ?? []) if (!informational.has(code)) issue(code);
  // Unknown support is disclosed, not inferred to be unsupported simply because a release is old.
  const behavior = metadata.candidate?.manifest.filter(e => (e.field === 'scripts' && ['preinstall', 'install', 'postinstall', 'prepare'].includes(e.key)) || e.field === 'bin' || e.field === 'gypfile') ?? [];
  if (!metadata.baseline && behavior.length) issue('INSTALL_BEHAVIOR_REVIEW');
  if (metadata.deltas.some(d => ['dependencies', 'optionalDependencies', 'peerDependencies', 'scripts', 'bin', 'gypfile'].includes(d.field)
    || (d.field === 'identity' && ['publisher', 'repository'].includes(d.key)))) issue('RELEASE_CHANGES_REVIEW');
  const initial = metadata.preflight;
  for (const i of initial.issues) if (!['COOLDOWN_INACTIVE_OR_WEAK', 'SCRIPTS_NOT_SUPPRESSED'].includes(i.code)) issue(i.code);
  const cutoff = new Date(Math.min(Date.now() - 7 * 86400000, Date.parse(initial.cutoff.effectiveBefore) || Infinity)).toISOString();
  const protectionFlags = [`--before=${cutoff}`, '--ignore-scripts=true'];
  if (metadata.candidate?.publishedAt && Date.parse(metadata.candidate.publishedAt) > Date.parse(cutoff)) issue('PROJECT_CUTOFF_NOT_MET');
  const effective = await preflight({ project: root, npmCli, environment, experimentalMacos, runtime, npmFlags: protectionFlags });
  for (const i of effective.issues) issue(i.code);
  const files = ['package.json', 'package-lock.json', '.npmrc'];
  const bytes = await Promise.all(files.map((f, i) => bounded(join(root, f), i === 2)));
  if (digest(bytes[0]) !== initial.inputDigests.manifest || digest(bytes[1]) !== initial.inputDigests.lockfile) issue('INPUT_CHANGED');
  if (canUseToolchain(initial.toolchain, experimentalMacos)) {
    const graph = normalizeGraph(JSON.parse(bytes[0]), JSON.parse(bytes[1]), await loadSemver(initial.toolchain.npmCli), initial.toolchain);
    for (const i of graph.issues) {
      if (i.code === 'EXCLUDED_OPTIONAL_BUNDLE') report.limitations.push(`Optional bundle excluded from ${initial.toolchain.platform}-${initial.toolchain.arch}: ${i.path}. Bundled contents were not reviewed.`);
      else issue(i.code);
    }
  }
  if (report.firewall && effective.toolchain.npmCli) report.command = {
    executable: report.firewall.kind === 'npm-launcher' ? process.execPath : report.firewall.path,
    args: [...(report.firewall.kind === 'npm-launcher' ? [report.firewall.path] : []),
      process.execPath, effective.toolchain.npmCli, 'install', `${publicPackage}@${version}`, '--save-exact',
      ...(dev ? ['--save-dev'] : []), ...protectionFlags, '--registry=https://registry.npmjs.org/', '--strict-ssl=true',
      '--allow-git=none', '--allow-remote=none', '--allow-file=none', '--allow-directory=none',
      '--audit=false', '--fund=false', '--update-notifier=false'] };
  if (report.issues.length) return report;
  report.status = 'ready';
  if (!install) return report;
  const current = await Promise.all(files.map((f, i) => bounded(join(root, f), i === 2)));
  if (current.some((b, i) => digest(b) !== digest(bytes[i])) || digest(await readFile(report.firewall.path)) !== report.firewall.sha256
    || (report.firewall.packagePath && digest(await readFile(report.firewall.packagePath)) !== report.firewall.packageSha256)) {
    issue('INPUT_OR_TOOL_CHANGED'); report.status = 'review'; return report;
  }
  const cache = await mkdtemp(join(tmpdir(), 'hardhat-install-cache-'));
  report.command.args.push(`--cache=${cache}`); // Do not clear the user's cache or silently reuse artifact downloads.
  report.authorization = 'explicit-install-command';
  report.execution = await runner(report.command.executable, report.command.args, root, environment);
  report.status = report.execution.code === 0 && !report.execution.stopped ? 'completed' : 'stopped';
  if (report.status === 'stopped') issue('SFW_OR_NPM_STOPPED');
  if (report.status === 'completed') {
    try {
      const manifest = JSON.parse(await bounded(join(root, 'package.json')));
      const lock = JSON.parse(await bounded(join(root, 'package-lock.json')));
      const selected = lock.packages?.[`node_modules/${publicPackage}`];
      const integrity = metadata.candidate.claims.integrity === null ? null : JSON.parse(metadata.candidate.claims.integrity);
      if (manifest[dev ? 'devDependencies' : 'dependencies']?.[publicPackage] !== version || selected?.version !== version
        || (selected.name !== undefined && selected.name !== publicPackage) || !integrity || selected.integrity !== integrity) throw new Error('mismatch');
    } catch { report.status = 'review'; issue('INSTALL_RESULT_NOT_VERIFIED'); }
  }
  // A firewall exit code is an operation result, never a fabricated scan result.
  return report;
}
