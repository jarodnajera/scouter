import { mkdtemp, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { preflight, bounded } from './preflight.mjs';
import { normalizeGraph, compareGraphs, compareDeclarations, sanitizeManifest, loadSemver } from './graph.mjs';
import { normalizeRelease } from './metadata.mjs';
import { createMetadataClient, packageName, MetadataError, REGISTRY } from './registry.mjs';
import { hash, canonical, instant } from '../../evidence/canonical.mjs';
import { validate, ValidationError } from '../../evidence/validate.mjs';
import { graphSchema } from '../../../schemas/graph.mjs';

const sha = value => value === null ? null : createHash('sha256').update(value).digest('hex');
const parse = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const inside = (root, path) => { const rel = relative(root, path); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
export async function compareProject({ project, candidateManifest, candidateLock, baselineLock, publicPackages = [],
  npmCli, npmFlags, environment, experimentalMacos = false, runtime, client = createMetadataClient(), clock = () => new Date().toISOString() } = {}) {
  if (Boolean(candidateManifest) !== Boolean(candidateLock)) throw new ValidationError('Provide both candidate manifest and lockfile');
  if (!Array.isArray(publicPackages) || publicPackages.length > 100 || !publicPackages.every(packageName)
    || new Set(publicPackages).size !== publicPackages.length) throw new ValidationError('Public package permission must be an array of at most 100 unique valid names');
  const context = await preflight({ project, npmCli, npmFlags, environment, experimentalMacos, runtime, operation: 'locked-install' });
  const checkedAt = clock();
  const report = { schemaVersion: '1.1.0', toolVersion: '0.1.0', kind: 'graph-review-report', mode: 'supplied-proposal',
    decision: 'REVIEW', authorization: 'none', status: 'unavailable', checkedAt,
    expiresAt: new Date(Date.parse(checkedAt) + 3600000).toISOString(), preflight: context, snapshotDirectory: null,
    resolution: { available: false, reason: 'RESOLUTION_ISOLATION_UNAVAILABLE' },
    inputDigests: { baselineManifest: null, baselineLock: null, candidateManifest: null, candidateLock: null },
    baseline: null, candidate: null, declarationChanges: [], changes: [], releases: [], issues: [],
    limitations: ['Automatic npm resolution is disabled: no qualified filesystem/process/network isolation boundary is available.',
      'Candidate files are supplied evidence, not authenticated resolver output or installation authorization.',
      'Snapshots retain only sanitized manifests and normalized graphs; no hooks, local configuration, credentials or package code are copied.',
      'All instances, including dev/optional/peer and platform-conditional entries, are retained; target installation eligibility is not simulated.',
      'Only explicitly allowlisted public names may be queried. Missing release evidence remains unknown, including for unchanged artifacts.',
      'Registry and lockfile integrity are claims; no package bytes are fetched or verified. Artifact and scanner evidence remain incomplete.',
      'Temporary snapshots are retained, including after interruption; no recursive deletion or cleanup is performed.',
      'Input rereads detect changes but do not establish an atomic filesystem/config snapshot or protected binding.'] };
  const issue = (code, path = '') => report.issues.push({ code, path });
  const finish = () => validate(graphSchema, report);
  if (context.status === 'unsupported') { report.status = 'unsupported'; issue('UNSUPPORTED_PROJECT_CONTEXT'); return finish(); }
  if (!candidateManifest) { issue('RESOLUTION_ISOLATION_UNAVAILABLE'); issue('SUPPLIED_PROPOSAL_REQUIRED'); return finish(); }
  const paths = [join(context.projectRoot, 'package.json'), join(context.projectRoot, 'package-lock.json'),
    await realpath(resolve(candidateManifest)), await realpath(resolve(candidateLock)), join(context.projectRoot, '.npmrc')];
  const bytes = await Promise.all(paths.map((path, index) => bounded(path, index === 4)));
  const digestKeys = Object.keys(report.inputDigests);
  digestKeys.forEach((key, i) => { report.inputDigests[key] = sha(bytes[i]); });
  if (sha(bytes[0]) !== context.inputDigests.manifest || sha(bytes[1]) !== context.inputDigests.lockfile
    || (baselineLock && sha(await bounded(resolve(baselineLock))) !== sha(bytes[1]))) {
    report.status = 'unsupported'; issue('BASELINE_CHANGED_OR_MISMATCHED'); return finish();
  }
  const semver = await loadSemver(context.toolchain.npmCli);
  const baselineManifest = parse(bytes[0]), proposalManifest = parse(bytes[2]);
  report.baseline = normalizeGraph(baselineManifest, parse(bytes[1]), semver);
  report.candidate = normalizeGraph(proposalManifest, parse(bytes[3]), semver);
  if (baselineManifest.name !== proposalManifest.name || baselineManifest.version !== proposalManifest.version) issue('PROJECT_IDENTITY_CHANGED');
  report.declarationChanges = compareDeclarations(baselineManifest, proposalManifest, semver);
  report.changes = compareGraphs(report.baseline, report.candidate, semver);
  report.status = report.baseline.issues.length || report.candidate.issues.length || report.issues.length ? 'unsupported' : 'complete';
  // A task-owned, non-executable proposal snapshot; original files are never copied wholesale.
  if (report.status !== 'unsupported') {
    const temp = await realpath(tmpdir());
    if (inside(context.projectRoot, temp)) throw new ValidationError('Temporary snapshot root must be outside the source project');
    const workspace = await mkdtemp(join(temp, 'hardhat-proposal-'));
    report.snapshotDirectory = workspace;
    for (const [name, data] of [['baseline-manifest.json', sanitizeManifest(baselineManifest)],
      ['candidate-manifest.json', sanitizeManifest(proposalManifest)], ['baseline-graph.json', report.baseline], ['candidate-graph.json', report.candidate]]) {
      await writeFile(join(workspace, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
  }
  const artifacts = new Map();
  for (const node of report.candidate.instances) {
    const id = hash({ name: node.name, version: node.version, resolved: node.resolved, integrity: node.integrity });
    if (!artifacts.has(id)) artifacts.set(id, { node, record: { artifactId: id, name: node.name, version: node.version,
      paths: [], source: null, status: 'unavailable', publishedAt: null, ageSeconds: null, issues: [] } });
    artifacts.get(id).record.paths.push(node.path);
  }
  const groups = new Map();
  for (const artifact of artifacts.values()) {
    report.releases.push(artifact.record);
    if (!groups.has(artifact.node.name)) groups.set(artifact.node.name, []);
    groups.get(artifact.node.name).push(artifact);
  }
  const allowed = new Set(publicPackages), networkStart = Date.now();
  const networkAllowed = report.status !== 'unsupported' && context.registries.length > 0 && context.registries.every(r => r.public)
    && context.checks.every(c => c.status === 'complete')
    && !context.issues.some(i => ['INVALID_NPM_CONFIG', 'UNKNOWN_NPM_CONFIG', 'NPM_CONFIG_WARNING', 'CONFIG_READ_FAILED'].includes(i.code));
  for (const [name, group] of groups) {
    if (!networkAllowed || !allowed.has(name) || Date.now() - networkStart >= 60000) {
      for (const { record } of group) record.issues.push(!networkAllowed ? 'GRAPH_OR_PREFLIGHT_UNSUPPORTED' : !allowed.has(name) ? 'PUBLIC_LOOKUP_NOT_AUTHORIZED' : 'COLLECTION_BUDGET_EXCEEDED');
      continue;
    }
    try {
      const result = await client(name);
      for (const { node, record } of group) {
        record.source = result.source;
        try {
          const release = normalizeRelease(result.document, name, node.version, checkedAt);
          record.status = 'complete'; record.publishedAt = release.publishedAt; record.ageSeconds = release.ageSeconds; record.issues.push(...release.issues);
          const cutoff = instant(context.cutoff.effectiveBefore), published = instant(release.publishedAt);
          if (cutoff !== null && published !== null && published > cutoff) record.issues.push('PROJECT_CUTOFF_NOT_MET');
          const claimedIntegrity = release.claims.integrity === null ? null : JSON.parse(release.claims.integrity);
          const claimedTarball = release.claims.tarball === null ? null : JSON.parse(release.claims.tarball);
          if (claimedIntegrity !== node.integrity || claimedTarball !== node.resolved) record.issues.push('REGISTRY_LOCK_ARTIFACT_MISMATCH');
          const maps = new Map();
          for (const item of release.manifest) {
            if (!maps.has(item.field)) maps.set(item.field, new Map());
            maps.get(item.field).set(item.key, JSON.parse(item.value));
          }
          const expectedEdges = [];
          for (const type of ['dependencies', 'optionalDependencies', 'peerDependencies']) for (const [dependency, spec] of maps.get(type) ?? []) {
            if (type === 'dependencies' && maps.get('optionalDependencies')?.has(dependency)) continue;
            expectedEdges.push({ dependency, spec, type, optional: type === 'optionalDependencies'
              || (type === 'peerDependencies' && maps.get('peerDependenciesMeta')?.get(dependency)?.optional === true) });
          }
          const sorted = edges => edges.map(canonical).sort();
          for (const path of record.paths) {
            const actual = report.candidate.edges.filter(e => e.from === path).map(({ dependency, spec, type, optional }) => ({ dependency, spec, type, optional }));
            if (canonical(sorted(actual)) !== canonical(sorted(expectedEdges))) {
              record.issues.push('REGISTRY_LOCK_DEPENDENCIES_MISMATCH'); break;
            }
          }
        } catch (error) { if (!(error instanceof MetadataError)) throw error; record.issues.push(error.code); }
      }
    } catch (error) {
      if (!(error instanceof MetadataError)) throw error;
      for (const { record } of group) { record.source = new URL(encodeURIComponent(name), REGISTRY).href; record.issues.push(error.code); }
    }
  }
  if (report.status === 'complete' && report.releases.some(r => r.status !== 'complete' || r.issues.includes('PUBLISH_TIME_INVALID'))) report.status = 'partial';
  const current = await Promise.all(paths.map((path, index) => bounded(path, index === 4)));
  if (current.some((value, i) => sha(value) !== sha(bytes[i]))) { report.status = 'partial'; issue('INPUT_CHANGED'); }
  issue('REQUIRED_SECURITY_EVIDENCE_INCOMPLETE');
  return finish();
}
