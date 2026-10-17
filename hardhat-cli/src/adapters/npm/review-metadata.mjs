import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { preflight, bounded } from './preflight.mjs';
import { createMetadataClient, packageName, exactVersion, REGISTRY, MetadataError } from './registry.mjs';
import { normalizeRelease, compareReleases } from './metadata.mjs';
import { validate, ValidationError } from '../../evidence/validate.mjs';
import { metadataSchema } from '../../../schemas/metadata.mjs';

const sha = b => b === null ? null : createHash('sha256').update(b).digest('hex');
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function publicOrigin(value) {
  try { const u = new URL(value); return u.origin === REGISTRY.slice(0, -1) && !u.username && !u.password && !u.search && !u.hash; }
  catch { return false; }
}
export function selectBaseline(manifest, lock, dependency, name) {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (manifest[field]?.[dependency] !== lock.packages['']?.[field]?.[dependency]) throw new MetadataError('BASELINE_MANIFEST_LOCK_MISMATCH');
  }
  const specs = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .filter(f => obj(manifest[f]) && Object.hasOwn(manifest[f], dependency)).map(f => manifest[f][dependency]);
  if (specs.some(s => typeof s !== 'string') || new Set(specs).size > 1) throw new MetadataError('BASELINE_DECLARATION_CONFLICT');
  const spec = specs[0];
  if (spec?.startsWith('npm:')) {
    const match = /^npm:((?:@[^/]+\/)?[^@]+)@(.+)$/.exec(spec);
    if (!match || !packageName(match[1]) || match[1] !== name) throw new MetadataError('ALIAS_IDENTITY_MISMATCH');
  } else {
    if (dependency !== name) throw new MetadataError('ALIAS_IDENTITY_MISMATCH');
    // A registry range/tag is accepted as a declaration, never resolved here.
    if (spec && /[:/\\]|^\./.test(spec)) throw new MetadataError('UNSUPPORTED_DEPENDENCY_SOURCE');
  }
  const path = `node_modules/${dependency}`;
  const entry = Object.hasOwn(lock.packages, path) ? lock.packages[path] : null;
  if (!entry) {
    if (spec !== undefined) throw new MetadataError('DECLARED_BASELINE_MISSING');
    return { path: null, version: null, reason: 'new-package; no project-locked baseline; historical support is unknown' };
  }
  if (!obj(entry) || entry.link || !exactVersion(entry.version) || !publicOrigin(entry.resolved)
    || (entry.name !== undefined && entry.name !== name) || (spec?.startsWith('npm:') && entry.name !== name)) {
    throw new MetadataError('UNSUPPORTED_BASELINE');
  }
  if (spec === undefined) throw new MetadataError('BASELINE_NOT_DIRECT');
  return { path, version: entry.version, reason: 'project-locked direct dependency' };
}

// The explicitly named publicPackage is permission to disclose only that coordinate.
// Never enumerate a project's private dependency names into registry requests.
export async function reviewMetadata({ project, publicPackage, version, dependency = publicPackage, npmCli, npmFlags,
  environment, experimentalMacos = false, runtime, client = createMetadataClient(), clock = () => new Date().toISOString() } = {}) {
  if (!packageName(publicPackage) || !packageName(dependency) || !exactVersion(version)) throw new ValidationError('Expected an explicit public npm package, dependency name, and exact canonical version');
  const context = await preflight({ project, npmCli, npmFlags, environment, experimentalMacos, runtime, operation: 'resolution' });
  const checkedAt = clock();
  const report = { schemaVersion: '1.1.0', toolVersion: '0.1.0', kind: 'metadata-review-report', mode: 'live-metadata',
    authorization: 'none', decision: 'REVIEW', status: 'unavailable', checkedAt,
    expiresAt: new Date(Date.parse(checkedAt) + 3600000).toISOString(), requested: { publicPackage, dependency, version },
    preflight: context, source: null, attempts: 0,
    baselineSelection: { path: null, version: null, reason: 'not selected' }, baseline: null, candidate: null, deltas: [],
    issues: [], limitations: ['Partial metadata review only; no package or project code is executed or installed.',
      'Repository, publisher, signatures and attestations are registry claims, not independently verified identity or provenance.',
      'Support and withdrawal status remain unknown; a stable version or latest tag is not evidence of operational stability.',
      'Manifest deltas are declared changes, not the resolved transitive graph. No dependency coordinate discovered in metadata is queried.',
      'Artifact behavior, vulnerability and malware checks are unavailable. REVIEW never grants installation authorization.',
      'Only the explicitly named public package is queried; no credentials, private registry URLs or project files are transmitted.',
      'No historical baseline is inferred from version order or latest. Use compare for multiple or nested graph instances.',
      'This editable report and its redacted preflight digest are not an authenticated or atomic installation binding.'] };
  const issue = (code, subject = 'project') => report.issues.push({ code, subject });
  const finish = () => validate(metadataSchema, report);
  if (context.status === 'unsupported' || !context.registries.length || context.registries.some(r => !r.public)
    || context.checks.some(c => c.status !== 'complete') || context.issues.some(i => ['INVALID_NPM_CONFIG', 'UNKNOWN_NPM_CONFIG', 'NPM_CONFIG_WARNING', 'CONFIG_READ_FAILED'].includes(i.code))) {
    report.status = 'unsupported'; issue('PREFLIGHT_PREVENTS_PUBLIC_LOOKUP'); return finish();
  }
  const manifestPath = join(context.projectRoot, 'package.json'), lockPath = join(context.projectRoot, 'package-lock.json');
  const npmrcPath = join(context.projectRoot, '.npmrc');
  const manifestBytes = await bounded(manifestPath), lockBytes = await bounded(lockPath), configBytes = await bounded(npmrcPath, true);
  if (sha(manifestBytes) !== context.inputDigests.manifest || sha(lockBytes) !== context.inputDigests.lockfile) {
    report.status = 'unsupported'; issue('INPUT_CHANGED'); return finish();
  }
  try { report.baselineSelection = selectBaseline(JSON.parse(manifestBytes), JSON.parse(lockBytes), dependency, publicPackage); }
  catch (error) {
    if (!(error instanceof MetadataError)) throw error;
    report.status = 'unsupported'; issue(error.code); return finish();
  }
  try {
    report.source = new URL(encodeURIComponent(publicPackage), REGISTRY).href;
    const result = await client(publicPackage);
    report.source = result.source; report.attempts = result.attempts;
    for (const [role, selected] of [['candidate', version], ['baseline', report.baselineSelection.version]]) {
      if (selected === null) { issue('NO_BASELINE', role); continue; }
      try {
        report[role] = normalizeRelease(result.document, publicPackage, selected, checkedAt);
        for (const code of report[role].issues) issue(code, role);
      } catch (error) { if (!(error instanceof MetadataError)) throw error; issue(error.code, role); }
    }
    report.status = report.candidate && (report.baseline || report.baselineSelection.version === null) ? 'complete' : 'partial';
    report.deltas = compareReleases(report.baseline, report.candidate);
    if (report.deltas.length) issue('MANIFEST_OR_IDENTITY_CHANGED', 'comparison');
  } catch (error) {
    if (!(error instanceof MetadataError)) throw error;
    report.attempts = error.attempts ?? 0;
    issue(error.code, 'registry');
  }
  if (sha(await bounded(manifestPath)) !== sha(manifestBytes) || sha(await bounded(lockPath)) !== sha(lockBytes)
    || sha(await bounded(npmrcPath, true)) !== sha(configBytes)) {
    report.status = 'partial'; issue('INPUT_CHANGED');
  }
  issue('REQUIRED_EVIDENCE_INCOMPLETE');
  return finish();
}
