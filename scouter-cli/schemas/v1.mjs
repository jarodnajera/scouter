// Versioned, JSON-serializable JSON Schema documents. No external validator dependency.
const str = { type: 'string', minLength: 1, maxLength: 8192, pattern: '\\S' };
const text = { type: 'string', maxLength: 8192 };
const bool = { type: 'boolean' };
const nullableString = { type: ['string', 'null'], maxLength: 8192 };
const nullableBool = { type: ['boolean', 'null'] };
const integer = { type: 'integer', minimum: 0 };
const choices = (...values) => ({ type: 'string', enum: values });
const list = items => ({ type: 'array', items, maxItems: 10000 });
const object = (properties, optional = []) => ({ type: 'object', properties,
  required: Object.keys(properties).filter(k => !optional.includes(k)), additionalProperties: false });
const schema = (id, body) => ({ $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `urn:hardhat:${id}:1.0.0`, ...body });
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
export const bindingSchema = object({ manifestDigest: digest, lockfileDigest: digest,
  configDigest: digest, graphDigest: digest, policyRevision: str, target: str });
const manager = object({ name: str, version: str, nodeVersion: str, entrypoint: str,
  platform: str, arch: str });
const artifact = object({ id: str, ecosystem: str, name: str, version: str,
  registry: str, resolved: str, integrity: str, publishedAt: nullableString,
  releaseChannel: choices('stable', 'prerelease', 'unknown'), deprecated: nullableBool,
  withdrawn: nullableBool, support: choices('supported', 'unsupported', 'unknown') });
const instance = object({ id: str, artifactId: str, path: str, direct: bool,
  parentIds: list(str), dependencyType: choices('runtime', 'dev', 'optional', 'peer') });
export const checkSchema = object({ id: str, category: choices('context', 'graph', 'protections', 'binding',
  'identity', 'release', 'behavior', 'vulnerabilities', 'malware'), subject: str,
  status: choices('complete', 'partial', 'unavailable', 'unsupported', 'not_applicable'),
  coverage: choices('supported', 'unsupported', 'unknown'),
  outcome: choices('clear', 'concern', 'unknown'), source: str, checkedAt: nullableString,
  expiresAt: nullableString, details: text });
const finding = object({ id: str, artifactId: str, evidenceId: str,
  type: choices('malware', 'identity', 'integrity', 'vulnerability', 'behavior', 'release', 'conflict'),
  severity: choices('critical', 'high', 'moderate', 'low', 'info', 'unknown'),
  confirmation: choices('verified', 'suspected'), applicability: choices('affected', 'not_affected', 'unknown'),
  mitigated: bool, description: str });

export const evidenceSchema = schema('evidence', object({
  schemaVersion: choices('1.0.0'), kind: choices('review-evidence'), reviewId: str,
  operation: choices('add', 'upgrade', 'compare'),
  project: object({ manager, lockfileVersion: integer, workspaces: bool,
    baseline: choices('present', 'new-project', 'missing'), protectionsMode: choices('native', 'manual', 'unknown') }),
  binding: bindingSchema, currentBinding: bindingSchema,
  artifacts: list(artifact), instances: list(instance), checks: list(checkSchema), findings: list(finding),
}));

const exception = object({ id: str, actor: str, authorizationSource: str, rationale: str,
  artifactId: str, ruleCode: choices('AGE_TOO_RECENT', 'PRERELEASE', 'REVIEW_FINDING'),
  findingId: nullableString, operation: choices('add', 'upgrade', 'compare'),
  binding: bindingSchema, createdAt: str, expiresAt: str });
export const exceptionsSchema = schema('exceptions', object({ schemaVersion: choices('1.0.0'), exceptions: list(exception) }));

const reason = object({ code: str, level: choices('REVIEW', 'BLOCK'), subject: str,
  message: str, findingId: nullableString, exceptionId: nullableString });
const coverage = object({ category: str, subject: str,
  status: choices('complete', 'partial', 'unavailable', 'unsupported', 'not_applicable', 'missing', 'invalid', 'stale'),
  evidenceId: nullableString });
const envelope = {
  schemaVersion: choices('1.0.0'), toolVersion: choices('0.1.0'), mode: choices('supplied-evidence'),
  authorization: choices('none'), reviewId: str, evaluatedAt: str,
  inputDigest: digest, policyRevision: str, policyDigest: digest,
};
export const reportSchema = schema('review-report', object({ ...envelope,
  kind: choices('review-report'), operation: choices('add', 'upgrade', 'compare'),
  decision: choices('PASS', 'REVIEW', 'BLOCK'), expiresAt: str,
  binding: bindingSchema, coverage: list(coverage), reasons: list(reason),
  evidence: evidenceSchema,
  findings: list(finding), appliedExceptions: list(exception), rejectedExceptions: list(object({ id: str, reason: str })),
  limitations: list(str),
}));
export const inspectionSchema = schema('inspection-report', object({ ...envelope,
  kind: choices('inspection-report'), status: choices('complete', 'unsupported'),
  manager, lockfileVersion: integer, issues: list(str), limitations: list(str),
}));
export const errorSchema = schema('error-report', object({ schemaVersion: choices('1.0.0'),
  toolVersion: choices('0.1.0'), kind: choices('error-report'), code: str, message: str,
  authorization: choices('none') }));
