// Internal child: loads trusted npm config code, never a project command or plugin.
// stdout contains allowlisted, redacted data only; exceptions/log messages are not forwarded.
import { createRequire } from 'node:module';
import { realpath } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const KEYS = ['min-release-age', 'before', 'min-release-age-exclude', 'ignore-scripts',
  'dangerously-allow-all-scripts', 'strict-allow-scripts', 'package-lock', 'package-lock-only',
  'global', 'location', 'workspaces', 'workspace', 'strict-ssl', 'allow-git', 'allow-remote', 'allow-directory', 'allow-file',
  'force', 'os', 'cpu', 'libc'];
try {
  let configWarning = false;
  process.on('log', level => { if (level === 'warn' || level === 'error') configWarning = true; });
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 2 * 1024 * 1024) throw new Error('oversize'); }
  const { npmRoot, cwd, environment, npmFlags } = JSON.parse(input);
  const req = createRequire(resolve(npmRoot, 'package.json'));
  for (const id of ['@npmcli/config', '@npmcli/config/lib/definitions']) {
    const modulePath = await realpath(req.resolve(id));
    const rel = relative(npmRoot, modulePath);
    if (rel.startsWith(`..${sep}`) || rel === '..' || resolve(npmRoot, rel) !== modulePath) throw new Error('module escape');
  }
  const Config = req('@npmcli/config');
  const { definitions, flatten, shorthands, nerfDarts } = req('@npmcli/config/lib/definitions');
  const conf = new Config({ npmPath: npmRoot, definitions, flatten, shorthands, nerfDarts,
    argv: [process.execPath, resolve(npmRoot, 'bin/npm-cli.js'), 'install', ...npmFlags],
    env: environment, cwd, execPath: process.execPath, warn: false });
  await conf.load();
  const issues = [];
  try { if (!conf.validate()) issues.push('INVALID_NPM_CONFIG'); } catch { issues.push('INVALID_NPM_CONFIG'); }
  if (configWarning) issues.push('NPM_CONFIG_WARNING');
  // Never emit raw npm warnings: they may contain arbitrary config keys or secrets.
  const internal = new Set(['npm-version', 'global-prefix', 'local-prefix']);
  for (const { raw } of conf.data.values()) for (const key of Object.keys(raw ?? {})) {
    const base = key.split(':').at(-1);
    if (!Object.hasOwn(definitions, key) && !internal.has(key)
      && !(/^@.*:registry$/i.test(key) || (key.startsWith('//') && nerfDarts.includes(base)))) {
      issues.push('UNKNOWN_NPM_CONFIG');
    }
  }
  for (const entry of conf.data.values()) if (entry.loadError && entry.loadError.code !== 'ENOENT') issues.push('CONFIG_READ_FAILED');
  const safeValue = (key, value) => {
    if (value == null) return null;
    if (key === 'before') return value instanceof Date && Number.isFinite(+value) ? value.toISOString() : '[invalid]';
    if (['min-release-age-exclude', 'workspace'].includes(key)) return Array.isArray(value) ? `${value.length} entries (values withheld)` : '[invalid]';
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    if (['all', 'none', 'root', 'global', 'user', 'project'].includes(value)) return value;
    return '[unrecognized value withheld]';
  };
  const settings = KEYS.map(key => ({ key, value: safeValue(key, conf.get(key)),
    source: conf.find(key) ?? 'unknown', supported: Object.hasOwn(definitions, key) }));
  const flat = conf.flat;
  const order = ['default', 'builtin', 'global', 'user', 'project', 'env', 'cli'];
  const ageWhere = conf.find('min-release-age'), beforeWhere = conf.find('before');
  const source = conf.get('before') != null && order.indexOf(beforeWhere) >= order.indexOf(ageWhere)
    ? beforeWhere : conf.get('min-release-age') != null ? ageWhere : null;
  const effectiveBefore = flat.before instanceof Date && Number.isFinite(+flat.before) ? flat.before.toISOString() : null;
  const evaluationTime = Date.now();
  const strongerSources = [];
  for (const where of order) {
    const age = conf.get('min-release-age', where), before = conf.get('before', where);
    const candidates = [];
    if (typeof age === 'number' && Number.isFinite(age) && age >= 0) candidates.push(evaluationTime - age * 86400000);
    if (before instanceof Date && Number.isFinite(+before)) candidates.push(+before);
    if (candidates.some(t => effectiveBefore === null || t < Date.parse(effectiveBefore) - 1000)) strongerSources.push(where);
  }
  const registryKeys = new Set(['registry']);
  for (const { data } of conf.data.values()) for (const key of Object.keys(data)) {
    if (/^@.*:registry$/i.test(key)) registryKeys.add(key);
  }
  const registries = [...registryKeys].sort().map((key, index) => {
    let isPublic = false;
    try {
      const url = new URL(conf.get(key));
      isPublic = url.origin === 'https://registry.npmjs.org' && url.pathname === '/'
        && !url.username && !url.password && !url.search && !url.hash;
    } catch { /* withheld */ }
    return { scope: key === 'registry' ? 'default' : `scoped-registry-${index}`,
      display: isPublic ? 'https://registry.npmjs.org/' : '[non-public or credential-bearing URL withheld]',
      source: conf.find(key) ?? 'unknown', public: isPublic };
  });
  process.stdout.write(JSON.stringify({ settings, registries, issues: [...new Set(issues)],
    effectiveBefore, cutoffSource: source, strongerSources,
    exclusionsPresent: Array.isArray(flat.minReleaseAgeExclude) && flat.minReleaseAgeExclude.length > 0,
    localPrefixMatches: (await realpath(conf.localPrefix)) === (await realpath(cwd)),
    globalMode: conf.get('global') === true || conf.get('location') === 'global' }));
} catch {
  process.stdout.write(JSON.stringify({ error: 'NPM_CONFIG_PROBE_FAILED' }));
  process.exitCode = 2;
}
