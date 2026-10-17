import { evidenceSchema, exceptionsSchema, reportSchema, inspectionSchema } from '../../schemas/v1.mjs';
import { validate, ValidationError } from '../evidence/validate.mjs';
import { hash, graphDigest, instant, same } from '../evidence/canonical.mjs';
import { DEFAULT_POLICY as policy } from './default.mjs';

const emptyExceptions = { schemaVersion: '1.0.0', exceptions: [] };
const iso = time => new Date(time).toISOString();
const unique = values => new Set(values).size === values.length;
const limitations = [
  'Supplied evidence only: no live registry, scanner, project inspection, or package execution.',
  'Evidence and exception records are unauthenticated assertions; this report is not installation authorization.',
  'No known findings in supplied sources does not prove package safety.',
];
function clock(now) {
  const time = instant(now);
  if (time === null) throw new ValidationError('now: expected valid UTC instant');
  return time;
}
function envelope(evidence, now) {
  return { schemaVersion: '1.0.0', toolVersion: '0.1.0', mode: 'supplied-evidence', authorization: 'none',
    reviewId: evidence.reviewId, evaluatedAt: iso(now), inputDigest: hash(evidence),
    policyRevision: policy.revision, policyDigest: hash(policy) };
}
export function compatibilityIssues(e) {
  const m = e.project.manager;
  const issues = [];
  if (m.name !== 'npm' || m.version !== policy.npmVersion || m.nodeVersion !== policy.nodeVersion
    || m.platform !== policy.platform || m.arch !== policy.arch) issues.push('UNSUPPORTED_TOOLCHAIN');
  if (e.project.lockfileVersion !== policy.lockfileVersion) issues.push('UNSUPPORTED_LOCKFILE');
  if (e.project.workspaces) issues.push('UNSUPPORTED_WORKSPACE');
  if (e.project.baseline === 'missing' || (e.project.baseline === 'new-project' && e.operation !== 'add')) issues.push('MISSING_BASELINE');
  return issues;
}
export function inspect(evidence, { now } = {}) {
  validate(evidenceSchema, evidence);
  const time = clock(now), issues = compatibilityIssues(evidence);
  return validate(inspectionSchema, { ...envelope(evidence, time), kind: 'inspection-report',
    status: issues.length ? 'unsupported' : 'complete', manager: { ...evidence.project.manager },
    lockfileVersion: evidence.project.lockfileVersion, issues, limitations: [...limitations] });
}
export function evaluate(evidence, { now, exceptions = emptyExceptions } = {}) {
  validate(evidenceSchema, evidence);
  validate(exceptionsSchema, exceptions);
  const time = clock(now);
  const reasons = [], coverage = [];
  let expires = time + policy.freshnessSeconds * 1000;
  const add = (code, subject, message, level = 'REVIEW', findingId = null) => {
    reasons.push({ code, subject, message, level, findingId, exceptionId: null });
  };
  for (const code of compatibilityIssues(evidence)) add(code, 'project', 'Project is outside the qualified review baseline.');
  if (evidence.project.protectionsMode === 'unknown') add('UNKNOWN_PROTECTIONS', 'project', 'Native protection or equivalent manual checks are not established.');
  if (!same(evidence.binding, evidence.currentBinding)) add('BINDING_CHANGED', 'project', 'Current inputs differ from the evidence binding.');
  if (evidence.binding.graphDigest !== graphDigest(evidence)) add('GRAPH_DIGEST_MISMATCH', 'project', 'Graph digest does not match supplied artifact identities and instances.');
  if (evidence.binding.policyRevision !== policy.revision) add('POLICY_CHANGED', 'project', 'Evidence refers to another policy revision.');
  if (evidence.binding.target !== `${policy.platform}-${policy.arch}`) add('UNSUPPORTED_TARGET', 'project', 'Target is not qualified.');
  if (evidence.artifacts.length === 0 || evidence.instances.length === 0) add('EMPTY_GRAPH', 'project', 'No reviewable dependency graph supplied.');
  for (const [name, rows] of [['artifacts', evidence.artifacts], ['instances', evidence.instances], ['checks', evidence.checks], ['findings', evidence.findings]]) {
    if (!unique(rows.map(r => r.id))) add('DUPLICATE_ID', 'project', `Duplicate identifiers in ${name}.`);
  }
  const artifacts = new Map(evidence.artifacts.map(a => [a.id, a]));
  const nodes = new Map(evidence.instances.map(i => [i.id, i]));
  const checks = new Map(evidence.checks.map(c => [c.id, c]));
  const referenced = new Set();
  if (!unique(evidence.instances.map(i => i.path))) add('GRAPH_REFERENCE_INVALID', 'project', 'Multiple graph instances occupy the same lockfile path.');
  for (const node of evidence.instances) {
    referenced.add(node.artifactId);
    if (!artifacts.has(node.artifactId) || node.parentIds.some(p => !nodes.has(p))
      || (!node.direct && node.parentIds.length === 0)) add('GRAPH_REFERENCE_INVALID', node.id, 'Graph instance has missing artifact or parent references.');
  }
  const reachable = new Set(evidence.instances.filter(n => n.direct).map(n => n.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of evidence.instances) if (!reachable.has(node.id) && node.parentIds.some(p => reachable.has(p))) {
      reachable.add(node.id); changed = true;
    }
  }
  if (reachable.size !== nodes.size) add('GRAPH_DISCONNECTED', 'project', 'Graph contains instances with no path from a direct dependency.');
  for (const a of evidence.artifacts) {
    if (a.id === 'project' || !referenced.has(a.id)) add('GRAPH_REFERENCE_INVALID', a.id, 'Artifact has no valid graph instance or uses a reserved identifier.');
    if (a.ecosystem !== 'npm') add('UNSUPPORTED_ECOSYSTEM', a.id, 'Only npm registry artifacts are supported.');
    const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(a.version);
    if (a.name.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(a.name)
      || !version || version[4]?.split('.').some(s => /^0\d+$/.test(s))) {
      add('UNSUPPORTED_COORDINATE', a.id, 'An exact supported npm coordinate is required.');
    }
    try {
      const registry = new URL(a.registry), resolved = new URL(a.resolved);
      if ([registry, resolved].some(u => u.origin !== 'https://registry.npmjs.org' || u.username || u.password)
        || registry.pathname !== '/' || registry.search || registry.hash || resolved.search || resolved.hash) {
        add('UNSUPPORTED_ORIGIN', a.id, 'Artifact origin is outside the public npm adapter target.');
      }
    } catch { add('UNSUPPORTED_ORIGIN', a.id, 'Invalid registry or artifact URL.'); }
    if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(a.integrity)) add('INTEGRITY_EVIDENCE_INVALID', a.id, 'Expected SHA-512 artifact integrity.');
    const published = instant(a.publishedAt);
    if (published === null || published > time) add('PUBLISH_TIME_INVALID', a.id, 'Publication timestamp is missing, invalid, or in the future.');
    else if (time - published < policy.minimumAgeSeconds * 1000) add('AGE_TOO_RECENT', a.id, 'Exact release is inside the seven-day cooldown.');
    if (a.releaseChannel === 'unknown' || a.deprecated === null || a.withdrawn === null) add('RELEASE_STATUS_UNKNOWN', a.id, 'Required release status is unknown.');
    if (a.releaseChannel === 'prerelease' || /^\d+\.\d+\.\d+-/.test(a.version)) add('PRERELEASE', a.id, 'Prerelease requires a scoped exception.');
    if (a.deprecated) add('RELEASE_DEPRECATED', a.id, 'Deprecated release needs review.');
    if (a.withdrawn) add('RELEASE_WITHDRAWN', a.id, 'Withdrawn release needs review.');
    if (a.support === 'unsupported') add('RELEASE_UNSUPPORTED', a.id, 'Release is known to be unsupported.');
  }
  const expected = [
    ...policy.projectCategories.map(category => ({ category, subject: 'project' })),
    ...evidence.artifacts.flatMap(a => policy.artifactCategories.map(category => ({ category, subject: a.id }))),
  ];
  const expectedKeys = new Set(expected.map(c => JSON.stringify([c.category, c.subject])));
  for (const check of evidence.checks) {
    if (!expectedKeys.has(JSON.stringify([check.category, check.subject]))) add('CHECK_SUBJECT_INVALID', check.subject, 'Evidence category does not apply to this subject.');
  }
  for (const required of expected) {
    const matches = evidence.checks.filter(c => c.category === required.category && c.subject === required.subject);
    if (matches.length !== 1) {
      coverage.push({ ...required, status: matches.length ? 'invalid' : 'missing', evidenceId: null });
      add(matches.length ? 'DUPLICATE_CHECK' : 'MISSING_EVIDENCE', required.subject, `Required ${required.category} evidence must occur exactly once.`);
      continue;
    }
    const c = matches[0];
    let status = c.status;
    const checked = instant(c.checkedAt), explicitExpiry = c.expiresAt === null ? null : instant(c.expiresAt);
    if (checked === null || checked > time || (c.expiresAt !== null && (explicitExpiry === null || explicitExpiry <= checked))) {
      status = 'invalid'; add('EVIDENCE_TIME_INVALID', c.subject, `${c.category} has an invalid collection/expiry time.`);
    } else {
      const end = Math.min(checked + policy.freshnessSeconds * 1000, explicitExpiry ?? Infinity);
      expires = Math.min(expires, end);
      if (time >= end) { status = 'stale'; add('STALE_EVIDENCE', c.subject, `${c.category} evidence has expired.`); }
    }
    if (c.status !== 'complete' || c.coverage !== 'supported' || c.outcome !== 'clear') {
      add('INCOMPLETE_EVIDENCE', c.subject, `${c.category}: status=${c.status}, coverage=${c.coverage}, outcome=${c.outcome}.`);
      if (status === 'complete') status = 'partial';
    }
    coverage.push({ ...required, status, evidenceId: c.id });
  }
  for (const f of evidence.findings) {
    const linked = checks.get(f.evidenceId);
    const category = f.type === 'vulnerability' ? 'vulnerabilities' : f.type === 'integrity' ? 'identity'
      : f.type === 'conflict' ? null : f.type;
    if (!artifacts.has(f.artifactId) || !linked || linked.subject !== f.artifactId || (category && linked.category !== category)) {
      add('FINDING_REFERENCE_INVALID', f.artifactId, 'Finding has invalid subject/evidence linkage.', 'REVIEW', f.id);
    }
    const confirmedCompromise = f.confirmation === 'verified' && ['malware', 'identity', 'integrity'].includes(f.type);
    if (confirmedCompromise) {
      add(`VERIFIED_${f.type.toUpperCase()}`, f.artifactId, f.description, 'BLOCK', f.id);
    } else if (f.type === 'vulnerability' && f.confirmation === 'verified' && f.applicability === 'affected'
      && !f.mitigated && ['high', 'critical'].includes(f.severity)) {
      add('HIGH_CRITICAL_VULNERABILITY', f.artifactId, f.description, 'BLOCK', f.id);
    } else if (f.applicability !== 'not_affected' && !(f.type === 'vulnerability' && f.mitigated && f.confirmation === 'verified')) {
      add('REVIEW_FINDING', f.artifactId, f.description, 'REVIEW', f.id);
    }
  }

  const appliedExceptions = [], rejectedExceptions = [];
  const counts = new Map();
  for (const x of exceptions.exceptions) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
  for (const x of exceptions.exceptions) {
    const start = instant(x.createdAt), end = instant(x.expiresAt);
    let rejection = null;
    if (counts.get(x.id) !== 1) rejection = 'Duplicate exception identifier';
    else if (start === null || end === null || start > time || end <= time || end <= start) rejection = 'Invalid, future, or expired exception';
    else if (!same(x.binding, evidence.binding) || x.operation !== evidence.operation) rejection = 'Exception binding or operation does not match';
    else if (!artifacts.has(x.artifactId)) rejection = 'Exception artifact is not in the graph';
    else if ((x.ruleCode === 'REVIEW_FINDING') !== (x.findingId !== null)) rejection = 'Finding scope is invalid';
    const applicable = rejection ? [] : reasons.filter(r => r.level === 'REVIEW' && r.exceptionId === null
      && r.code === x.ruleCode && r.subject === x.artifactId && r.findingId === x.findingId);
    if (!rejection && !applicable.length) rejection = 'No matching waivable finding';
    if (rejection) rejectedExceptions.push({ id: x.id, reason: rejection });
    else {
      for (const reason of applicable) reason.exceptionId = x.id;
      appliedExceptions.push(structuredClone(x)); expires = Math.min(expires, end);
    }
  }
  const active = reasons.filter(r => r.exceptionId === null);
  const decision = active.some(r => r.level === 'BLOCK') ? 'BLOCK' : active.length ? 'REVIEW' : 'PASS';
  return validate(reportSchema, { ...envelope(evidence, time), kind: 'review-report', operation: evidence.operation,
    decision, expiresAt: iso(Math.max(time, expires)), binding: { ...evidence.binding }, coverage, reasons,
    findings: structuredClone(evidence.findings), appliedExceptions, rejectedExceptions,
    evidence: structuredClone(evidence),
    limitations: [...limitations, ...(evidence.project.protectionsMode === 'manual'
      ? ['Manual protection fallback claimed; native age enforcement is unavailable.'] : [])] });
}
