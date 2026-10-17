import { preflightSchema } from './preflight.mjs';
const s = { type: 'string', maxLength: 8192 }, n = { type: ['string', 'null'], maxLength: 8192 }, b = { type: 'boolean' };
const list = (items, maxItems = 40000) => ({ type: 'array', items, maxItems });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const instance = obj({ path: s, installedAs: s, name: s, version: s, origin: n, resolved: n, integrity: n,
  dev: b, optional: b, devOptional: b, peer: b, hasInstallScript: b, direct: b, reachable: b, parentPaths: list(s),
  conditions: obj({ os: list(s), cpu: list(s), libc: list(s) }), engines: list(obj({ name: s, range: s })) });
const issue = obj({ code: s, path: s });
const graph = { ...obj({ instances: list(instance, 10000), edges: list(obj({ from: s, to: n, dependency: s, spec: s, type: s, optional: b })),
  digest: s, issues: list(issue) }), type: ['object', 'null'] };
export const graphSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:hardhat:graph:1.1.0',
  ...obj({ schemaVersion: { type: 'string', enum: ['1.1.0'] }, toolVersion: { type: 'string', enum: ['0.1.0'] },
    kind: { type: 'string', enum: ['graph-review-report'] }, mode: { type: 'string', enum: ['supplied-proposal'] },
    decision: { type: 'string', enum: ['REVIEW'] }, authorization: { type: 'string', enum: ['none'] },
    status: { type: 'string', enum: ['complete', 'partial', 'unsupported', 'unavailable'] },
    checkedAt: s, expiresAt: s, preflight: preflightSchema, snapshotDirectory: n,
    resolution: obj({ available: { type: 'boolean', enum: [false] }, reason: s }),
    inputDigests: obj({ baselineManifest: n, baselineLock: n, candidateManifest: n, candidateLock: n }),
    baseline: graph, candidate: graph,
    declarationChanges: list(obj({ field: s, key: s, before: n, after: n })),
    changes: list(obj({ path: s, kinds: list(s), before: { ...instance, type: ['object', 'null'] }, after: { ...instance, type: ['object', 'null'] } })),
    releases: list(obj({ artifactId: s, name: s, version: s, paths: list(s), source: n,
      status: { type: 'string', enum: ['complete', 'unavailable', 'unsupported'] }, publishedAt: n,
      ageSeconds: { type: ['number', 'null'], minimum: 0 }, issues: list(s) })),
    issues: list(issue), limitations: list(s),
  }),
};
