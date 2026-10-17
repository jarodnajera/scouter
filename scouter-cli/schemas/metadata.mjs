import { preflightSchema } from './preflight.mjs';
const s = { type: 'string', maxLength: 8192 };
const n = { type: ['string', 'null'], maxLength: 8192 };
const list = items => ({ type: 'array', items, maxItems: 20000 });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const release = { ...obj({ name: s, version: s, publishedAt: n, ageSeconds: { type: ['number', 'null'], minimum: 0 },
  channel: { type: 'string', enum: ['prerelease', 'stable-version'] }, deprecated: n,
  support: { type: 'string', enum: ['unknown'] }, withdrawn: { type: 'string', enum: ['unknown'] },
  manifest: list(obj({ field: s, key: s, value: s })),
  claims: obj(Object.fromEntries(['repository', 'publisher', 'maintainers', 'integrity', 'shasum', 'tarball',
    'signatures', 'attestations', 'npmVersion', 'nodeVersion'].map(k => [k, n]))), issues: list(s) }), type: ['object', 'null'] };
export const metadataSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:hardhat:metadata:1.1.0',
  ...obj({ schemaVersion: { type: 'string', enum: ['1.1.0'] }, toolVersion: { type: 'string', enum: ['0.1.0'] },
    kind: { type: 'string', enum: ['metadata-review-report'] }, mode: { type: 'string', enum: ['live-metadata'] },
    authorization: { type: 'string', enum: ['none'] }, decision: { type: 'string', enum: ['REVIEW'] },
    status: { type: 'string', enum: ['complete', 'partial', 'unavailable', 'unsupported'] },
    checkedAt: s, expiresAt: s, requested: obj({ publicPackage: s, dependency: s, version: s }),
    preflight: preflightSchema, source: n, attempts: { type: 'integer', minimum: 0 },
    baselineSelection: obj({ path: n, version: n, reason: s }), baseline: release, candidate: release,
    deltas: list(obj({ field: s, key: s, change: { type: 'string', enum: ['added', 'removed', 'changed'] }, before: n, after: n })),
    issues: list(obj({ code: s, subject: s })), limitations: list(s),
  }),
};
