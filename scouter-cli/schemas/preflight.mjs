import { checkSchema } from './v1.mjs';
const s = { type: 'string', maxLength: 8192 };
const n = { type: ['string', 'null'], maxLength: 8192 };
const b = { type: 'boolean' };
const list = items => ({ type: 'array', items, maxItems: 10000 });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const preflightSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:hardhat:preflight:1.1.0',
  ...obj({ schemaVersion: { type: 'string', enum: ['1.1.0'] }, toolVersion: { type: 'string', enum: ['0.1.0'] },
    kind: { type: 'string', enum: ['preflight-report'] }, mode: { type: 'string', enum: ['live-preflight'] },
    authorization: { type: 'string', enum: ['none'] },
    status: { type: 'string', enum: ['complete', 'review', 'unsupported'] },
    checkedAt: s, projectRoot: s, operation: { type: 'string', enum: ['resolution', 'locked-install', 'runner'] },
    intendedManager: s, managerSignals: list(obj({ manager: s, source: s })),
    toolchain: obj({ nodeVersion: s, npmVersion: n, npmCli: n, platform: s, arch: s, qualified: b, supportStatus: { type: 'string', enum: ['validated', 'experimental', 'unsupported'] } }),
    protectionMode: { type: 'string', enum: ['native', 'manual-required', 'unknown'] },
    settings: list(obj({ key: s, value: n, source: s, supported: b })),
    registries: list(obj({ scope: s, display: s, source: s, public: b })),
    cutoff: obj({ effectiveBefore: n, source: n, meetsSevenDayPolicy: b, exclusionsPresent: b }),
    issues: list(obj({ code: s, scope: { type: 'string', enum: ['context', 'protections'] }, message: s })),
    inputDigests: obj({ manifest: n, lockfile: n, relevantConfig: n }),
    checks: list(checkSchema), limitations: list(s),
  }),
};
