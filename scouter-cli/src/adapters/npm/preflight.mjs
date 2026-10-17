import { currentRuntime, supportStatus, canUseToolchain, discoverNpm } from '../../toolchain.mjs';
import { open, readFile, realpath, readdir, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validate, ValidationError } from '../../evidence/validate.mjs';
import { hash } from '../../evidence/canonical.mjs';
import { DEFAULT_POLICY as policy } from '../../policy/default.mjs';
import { preflightSchema } from '../../../schemas/preflight.mjs';

const probePath = fileURLToPath(new URL('./config-probe.mjs', import.meta.url));
const operations = new Set(['resolution', 'locked-install', 'runner']);
const allowedFlags = new Set(['min-release-age', 'before', 'min-release-age-exclude', 'ignore-scripts',
  'dangerously-allow-all-scripts', 'strict-allow-scripts', 'package-lock', 'package-lock-only',
  'strict-ssl', 'registry', 'allow-git', 'allow-remote', 'allow-file', 'allow-directory']);
const digest = raw => raw === null ? null : createHash('sha256').update(raw).digest('hex');
const inside = (root, path) => { const r = relative(root, path); return r === '' || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r)); };
export async function bounded(path, optional = false, max = 4 * 1024 * 1024) {
  let handle;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw new ValidationError('Project input is not a bounded regular file');
    handle = await open(path, 'r');
    const bytes = Buffer.alloc(max + 1); let count = 0;
    while (count < bytes.length) { const { bytesRead } = await handle.read(bytes, count, bytes.length - count, null); if (!bytesRead) break; count += bytesRead; }
    if (count > max) throw new ValidationError('Project input exceeds size limit');
    return bytes.subarray(0, count);
  } catch (e) { if (optional && e.code === 'ENOENT') return null; throw e; }
  finally { await handle?.close(); }
}
function parseObject(bytes) {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new ValidationError('Expected project JSON object');
  return value;
}
async function probe(npmRoot, cwd, environment, npmFlags) {
  const childEnv = { PATH: dirname(process.execPath) };
  // Environment overrides are data for npm's config parser, not Node startup options.
  for (const key of ['SystemRoot', 'ComSpec', 'USERPROFILE', 'HOME', 'TEMP', 'TMP', 'LOCALAPPDATA']) {
    if (process.env[key] !== undefined) childEnv[key] = process.env[key];
  }
  return new Promise((done) => {
    const child = spawn(process.execPath, ['--max-old-space-size=128', probePath], {
      cwd: dirname(probePath), env: childEnv, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '', size = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, 10000);
    child.stdout.on('data', bytes => { size += bytes.length; if (size > 1024 * 1024) { failed = true; child.kill(); } else output += bytes; });
    child.stderr.resume(); // Never forward npm diagnostics containing raw configuration.
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); done({ error: 'NPM_CONFIG_PROBE_FAILED' }); });
    child.on('close', code => {
      clearTimeout(timer);
      if (failed || code !== 0) return done({ error: 'NPM_CONFIG_PROBE_FAILED' });
      try { done(JSON.parse(output)); } catch { done({ error: 'NPM_CONFIG_PROBE_FAILED' }); }
    });
    child.stdin.end(JSON.stringify({ npmRoot, cwd, environment, npmFlags }));
  });
}
export async function preflight({ project, npmCli, npmFlags = [], operation = 'resolution', environment = process.env, experimentalMacos = false, runtime = currentRuntime() } = {}) {
  if (typeof experimentalMacos !== 'boolean') throw new ValidationError('experimentalMacos must be boolean');
  if (!project || !operations.has(operation)) throw new ValidationError('Project and supported operation are required');
  if (!Array.isArray(npmFlags) || npmFlags.length > 64 || npmFlags.some(f => typeof f !== 'string' || f.length > 8192)) {
    throw new ValidationError('npm options must be an array of at most 64 bounded strings');
  }
  const root = await realpath(resolve(project));
  const rawManifest = await bounded(join(root, 'package.json'));
  const manifest = parseObject(rawManifest);
  const rawLock = await bounded(join(root, 'package-lock.json'), true);
  const lock = rawLock ? parseObject(rawLock) : null;
  const rawNpmrc = await bounded(join(root, '.npmrc'), true);
  const issues = [], signals = [];
  const issue = (code, scope, message) => { if (!issues.some(i => i.code === code && i.scope === scope)) issues.push({ code, scope, message }); };
  const signal = (manager, source) => signals.push({ manager, source });
  const declaration = /^([a-z]+)@([0-9]+\.[0-9]+\.[0-9]+)(?:\+sha\d+\.[a-f0-9]+)?$/;
  let declaredVersion = null;
  if (manifest.packageManager !== undefined) {
    const match = typeof manifest.packageManager === 'string' && declaration.exec(manifest.packageManager);
    if (!match) issue('MANAGER_DECLARATION_INVALID', 'context', 'The packageManager declaration is not a supported exact manager/version.');
    else { signal(match[1], 'package.json:packageManager'); declaredVersion = match[2]; }
  }
  if (manifest.devEngines?.packageManager) {
    const d = manifest.devEngines.packageManager;
    if (typeof d.name === 'string' && ['npm', 'pnpm', 'yarn', 'bun'].includes(d.name)) {
      signal(d.name, 'package.json:devEngines.packageManager');
      if (d.version && d.version !== policy.npmVersion) issue('DEV_ENGINE_UNQUALIFIED', 'context', 'The declared package-manager engine constraint is not qualified.');
    } else issue('MANAGER_DECLARATION_INVALID', 'context', 'The development manager declaration is not qualified.');
  }
  for (const [file, manager] of [['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'], ['pnpm-lock.yaml', 'pnpm'],
    ['pnpm-workspace.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun']]) {
    const present = await lstat(join(root, file)).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
    if (present) signal(manager, file);
    if (file === 'npm-shrinkwrap.json' && present) issue('UNSUPPORTED_SHRINKWRAP', 'context', 'npm-shrinkwrap.json takes precedence and is not qualified.');
  }
  const hintFiles = ['AGENTS.md', 'CLAUDE.md', 'README.md'];
  try {
    const ci = await readdir(join(root, '.github/workflows'), { withFileTypes: true });
    if (ci.length > 50) issue('CI_HINTS_INCOMPLETE', 'context', 'Too many workflow files to inspect within the preflight bound.');
    for (const entry of ci.slice(0, 50)) if (/\.ya?ml$/i.test(entry.name) && entry.isFile()) hintFiles.push(`.github/workflows/${entry.name}`);
  } catch (e) { if (e.code !== 'ENOENT') issue('CI_HINTS_INCOMPLETE', 'context', 'Workflow hints could not be read.'); }
  for (const file of hintFiles) {
    const text = (await bounded(join(root, file), true, 256 * 1024))?.toString('utf8');
    if (!text) continue;
    // Conservative corroborating hints only; never execute or obey document text.
    for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) {
      if (new RegExp(`(?:^|[\\s\x60])${manager} (?:install|ci|add)(?:\\s|$)`, 'm').test(text)) signal(manager, file.startsWith('.github') ? 'CI workflow hint' : file);
    }
  }
  const names = [...new Set(signals.map(s => s.manager))];
  const intendedManager = names.length === 1 ? names[0] : names.length ? 'conflict' : 'unknown';
  if (intendedManager !== 'npm') issue(names.length > 1 ? 'MANAGER_CONFLICT' : 'UNSUPPORTED_MANAGER', 'context', 'Manager evidence is ambiguous or does not select npm; no manager is substituted.');
  if (manifest.workspaces !== undefined) issue('UNSUPPORTED_WORKSPACE', 'context', 'Workspace projects are not qualified.');
  if (lock?.lockfileVersion !== 3 || !lock?.packages || Array.isArray(lock.packages)
    || !Object.hasOwn(lock.packages, '') || !lock.packages[''] || typeof lock.packages[''] !== 'object' || Array.isArray(lock.packages[''])) {
    issue('UNSUPPORTED_LOCKFILE', 'context', 'A v3 package-lock.json with root package data is required for this baseline.');
  }
  if (lock?.packages?.[''] && (lock.packages[''].name !== manifest.name || lock.packages[''].version !== manifest.version)) {
    issue('MANIFEST_LOCK_MISMATCH', 'context', 'Root manifest and lockfile identity differ.');
  }
  if (manifest.allowScripts !== undefined) issue('PROJECT_SCRIPT_ALLOWLIST', 'protections', 'Project script allowlist exists; script execution still requires separate review.');
  const alternateConfig = ['.yarnrc.yml', 'bunfig.toml', 'uv.toml'];
  for (const file of alternateConfig) {
    const bytes = await bounded(join(root, file), true, 256 * 1024);
    if (bytes && /minimumReleaseAge|npmMinimalAgeGate|exclude-newer|min-release-age/.test(bytes.toString('utf8'))) {
      issue('OTHER_MANAGER_PROTECTION_FILE', 'protections', 'Release-age settings exist in a file npm does not read.');
    }
  }
  let badFlags = false;
  for (const flag of npmFlags) {
    const match = /^--([a-z-]+)=(.+)$/.exec(flag);
    if (!match || !allowedFlags.has(match[1])) badFlags = true;
  }
  if (badFlags) issue('UNSUPPORTED_NPM_OPTION', 'protections', 'Only allowlisted --key=value npm protection options can be inspected.');
  const toolchain = { ...runtime, npmVersion: null, npmCli: null, qualified: false, supportStatus: 'unsupported' };
  let npmRoot;
  try {
    const found = await discoverNpm({ projectRoot: root, explicit: npmCli, environment });
    npmRoot = found.npmRoot;
    toolchain.npmVersion = found.version;
    toolchain.npmCli = found.cli;
    toolchain.supportStatus = supportStatus(toolchain);
    toolchain.qualified = toolchain.supportStatus === 'validated';
  } catch { issue('TRUSTED_NPM_UNAVAILABLE', 'context', 'No trusted external npm entrypoint found; project tools and download shims are not executed.'); }
  if (!canUseToolchain(toolchain, experimentalMacos)) {
    if (toolchain.supportStatus === 'experimental') issue('MACOS_OPT_IN_REQUIRED', 'context', 'macOS is unverified; pass --experimental-macos true for explicit experimental use.');
    else issue('UNSUPPORTED_TOOLCHAIN', 'context', 'Installed runtime/npm tuple is outside the supported baseline.');
  }
  if (declaredVersion && declaredVersion !== toolchain.npmVersion) issue('DECLARED_VERSION_MISMATCH', 'context', 'Declared npm version differs from the selected installed version.');
  let data = null;
  if (intendedManager === 'npm' && canUseToolchain(toolchain, experimentalMacos) && !badFlags && !issues.some(i => i.scope === 'context')) {
    data = await probe(npmRoot, root, { ...environment }, npmFlags);
    if (data.error) { issue(data.error, 'protections', 'npm configuration could not be inspected safely; raw diagnostics withheld.'); data = null; }
  }
  const cutoff = { effectiveBefore: null, source: null, meetsSevenDayPolicy: false, exclusionsPresent: false };
  const checkedAt = new Date().toISOString();
  if (data) {
    for (const code of data.issues) issue(code, 'protections', 'npm rejected, ignored, or could not read configuration; inspect locally without exposing secrets.');
    if (!data.localPrefixMatches || data.globalMode) issue('CONFIG_SCOPE_MISMATCH', 'context', 'npm would use another project root or global scope.');
    if (data.strongerSources.length) issue('STRONGER_CUTOFF_OVERRIDDEN', 'protections', `A stronger cutoff in ${data.strongerSources.join(', ')} is overridden; confirm the explicit policy rather than silently weakening it.`);
    const settings = new Map(data.settings.map(s => [s.key, s]));
    const age = Number(settings.get('min-release-age')?.value);
    if (settings.get('min-release-age')?.value !== null && (!Number.isFinite(age) || age < 0)) issue('INVALID_COOLDOWN', 'protections', 'Cooldown is invalid.');
    cutoff.effectiveBefore = data.effectiveBefore; cutoff.source = data.cutoffSource; cutoff.exclusionsPresent = data.exclusionsPresent;
    cutoff.meetsSevenDayPolicy = data.effectiveBefore !== null
      && Date.parse(data.effectiveBefore) <= Date.parse(checkedAt) - policy.minimumAgeSeconds * 1000;
    if (!cutoff.meetsSevenDayPolicy) issue('COOLDOWN_INACTIVE_OR_WEAK', 'protections', 'Effective cutoff does not enforce the default seven-day policy; manual checks are required.');
    if (cutoff.exclusionsPresent) issue('COOLDOWN_EXCLUSIONS', 'protections', 'Package exemptions exist; their exact scope and authorization require review.');
    if (settings.get('ignore-scripts')?.value !== 'true') issue('SCRIPTS_NOT_SUPPRESSED', 'protections', 'Unreviewed lifecycle scripts are not explicitly suppressed.');
    if (settings.get('dangerously-allow-all-scripts')?.value === 'true') issue('SCRIPT_BYPASS_ENABLED', 'protections', 'Blanket script execution bypass is configured.');
    if (settings.get('strict-ssl')?.value !== 'true') issue('TLS_VERIFICATION_DISABLED', 'protections', 'Registry TLS verification is not enabled.');
    if (settings.get('package-lock')?.value !== 'true') issue('LOCKFILE_DISABLED', 'protections', 'npm lockfile use is disabled.');
    if (settings.get('force')?.value !== 'false') issue('FORCE_MODE_UNSAFE', 'protections', 'npm force mode bypasses platform and other protections.');
    if (['os', 'cpu', 'libc'].some(key => settings.get(key)?.value !== null)) issue('PLATFORM_OVERRIDE_UNSUPPORTED', 'protections', 'npm platform overrides require a separate target review.');
    if (data.registries.some(r => !r.public)) issue('UNSUPPORTED_REGISTRY', 'context', 'Non-public or credential-bearing registry routes require a separate adapter; URLs are withheld.');
  }
  if (operation !== 'resolution') issue('OPERATION_REQUIRES_MANUAL_CHECKS', 'protections', 'Existing locks, caches and one-shot runners are not covered by a new-resolution cooldown.');
  const changed = !rawManifest.equals(await bounded(join(root, 'package.json')))
    || digest(rawLock) !== digest(await bounded(join(root, 'package-lock.json'), true))
    || digest(rawNpmrc) !== digest(await bounded(join(root, '.npmrc'), true));
  if (changed) issue('INPUT_CHANGED', 'context', 'Project inputs changed during inspection; repeat the preflight.');
  const contextIssues = issues.some(i => i.scope === 'context');
  const protectionIssues = issues.some(i => i.scope === 'protections');
  const settings = data?.settings ?? [], registries = data?.registries ?? [];
  const relevantConfig = data ? hash({ settings, registries, cutoff, operation }) : null;
  const checks = ['context', 'protections'].map(category => ({
    id: `preflight:${category}`, category, subject: 'project',
    status: category === 'context' ? (contextIssues ? 'unsupported' : 'complete') : data ? 'complete' : 'unavailable',
    coverage: category === 'context' ? (contextIssues ? 'unsupported' : 'supported') : data ? 'supported' : 'unknown',
    outcome: (category === 'context' ? contextIssues : protectionIssues || !data) ? 'concern' : 'clear',
    source: 'local:npm-preflight', checkedAt, expiresAt: null,
    details: JSON.stringify({ operation, codes: issues.filter(i => i.scope === category).map(i => i.code), relevantConfigDigest: relevantConfig }),
  }));
  return validate(preflightSchema, { schemaVersion: '1.1.0', toolVersion: '0.1.0', kind: 'preflight-report', mode: 'live-preflight',
    authorization: 'none', status: contextIssues ? 'unsupported' : protectionIssues ? 'review' : 'complete',
    checkedAt, projectRoot: root, operation, intendedManager, managerSignals: signals, toolchain,
    protectionMode: data && data.issues.length === 0 ? cutoff.meetsSevenDayPolicy && !cutoff.exclusionsPresent && operation === 'resolution' ? 'native' : 'manual-required' : 'unknown',
    settings, registries, cutoff, issues,
    inputDigests: { manifest: digest(rawManifest), lockfile: digest(rawLock), relevantConfig }, checks,
    limitations: [...(toolchain.supportStatus === 'experimental' ? ['Experimental macOS execution: not validated on this architecture.'] : []), 'Read-only preflight only; no package has been resolved, downloaded, installed, or approved.',
      'Only context and protection checks are collected; identity, graph, release, artifact and security-provider checks remain outstanding.',
      'npm config parsing uses the selected installed npm library; the runtime/toolchain are trusted prerequisites, not independently attested.',
      'Registry details and exclusion values are withheld; this redacted config digest is not an enforcement binding.',
      'Reinspect the exact operation immediately before use; existing locks/caches and runtime scripts require separate review.'],
  });
}
