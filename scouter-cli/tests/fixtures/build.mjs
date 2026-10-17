import { graphDigest } from '../../src/evidence/canonical.mjs';

export const NOW = '2026-10-16T18:00:00.000Z';
export function bind(e) {
  e.binding.graphDigest = graphDigest(e);
  e.currentBinding = structuredClone(e.binding);
  return e;
}
export function baseline() {
  const artifacts = ['parent', 'leaf'].map(name => ({
    id: name, ecosystem: 'npm', name: `scouter-fixture-${name}`, version: '1.0.0',
    registry: 'https://registry.npmjs.org/',
    resolved: `https://registry.npmjs.org/scouter-fixture-${name}/-/scouter-fixture-${name}-1.0.0.tgz`,
    integrity: `sha512-${Buffer.alloc(64, name === 'parent' ? 1 : 2).toString('base64')}`,
    publishedAt: '2026-09-01T00:00:00.000Z', releaseChannel: 'stable',
    deprecated: false, withdrawn: false, support: 'unknown',
  }));
  const check = (category, subject) => ({ id: `${subject}:${category}`, category, subject,
    status: 'complete', coverage: 'supported', outcome: 'clear', source: 'fixture:synthetic-evidence',
    checkedAt: '2026-10-16T17:50:00.000Z', expiresAt: null,
    details: 'Synthetic collector assertion for testing only; no real package was checked.' });
  return bind({ schemaVersion: '1.0.0', kind: 'review-evidence', reviewId: 'fixture-baseline', operation: 'upgrade',
    project: { manager: { name: 'npm', version: '11.19.1', nodeVersion: '24.22.0',
      entrypoint: 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js', platform: 'win32', arch: 'x64' },
      lockfileVersion: 3, workspaces: false, baseline: 'present', protectionsMode: 'native' },
    binding: { manifestDigest: 'a'.repeat(64), lockfileDigest: 'b'.repeat(64), configDigest: 'c'.repeat(64),
      graphDigest: '0'.repeat(64), policyRevision: 'phase0-policy-1', target: 'win32-x64' },
    currentBinding: {}, artifacts,
    instances: [
      { id: 'node_modules/parent', artifactId: 'parent', path: 'node_modules/parent', direct: true, parentIds: [], dependencyType: 'dev' },
      { id: 'node_modules/leaf', artifactId: 'leaf', path: 'node_modules/leaf', direct: false, parentIds: ['node_modules/parent'], dependencyType: 'runtime' },
    ],
    checks: [ ...['context', 'graph', 'protections', 'binding'].map(c => check(c, 'project')),
      ...artifacts.flatMap(a => ['identity', 'release', 'behavior', 'vulnerabilities', 'malware'].map(c => check(c, a.id))) ], findings: [],
  });
}
export function finding(overrides = {}) {
  return { id: 'finding-1', artifactId: 'leaf', evidenceId: 'leaf:vulnerabilities', type: 'vulnerability',
    severity: 'high', confirmation: 'verified', applicability: 'affected', mitigated: false,
    description: 'Synthetic advisory', ...overrides };
}
export function exception(e, overrides = {}) {
  return { id: 'exception-1', actor: 'fixture-user', authorizationSource: 'fixture:explicit-user-approval',
    rationale: 'Synthetic narrowly scoped cooldown exception', artifactId: 'leaf', ruleCode: 'AGE_TOO_RECENT', findingId: null,
    operation: e.operation, binding: structuredClone(e.binding), createdAt: '2026-10-16T17:55:00.000Z',
    expiresAt: '2026-10-16T18:30:00.000Z', ...overrides };
}
