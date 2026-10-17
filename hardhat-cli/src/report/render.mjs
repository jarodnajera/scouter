import { instant } from '../evidence/canonical.mjs';
// Escape terminal control characters and bidirectional formatting in user-facing text.
export const safeText = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
  c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const supportLine = toolchain => `Toolchain support: ${safeText(toolchain.supportStatus)} (${safeText(toolchain.platform)}-${safeText(toolchain.arch)})${toolchain.supportStatus === 'experimental' ? '; macOS validation pending' : ''}`;
export function renderText(report) {
  if (report.kind === 'error-report') return `Error [${safeText(report.code)}]: ${safeText(report.message)}\n`;
  if (report.kind === 'dependency-workflow-report') return [
    `Dependency ${report.mode}: ${report.status.toUpperCase()}`,
    `${safeText(report.requested.name)}@${safeText(report.requested.version)}`,
    supportLine(report.metadata.preflight.toolchain),
    `Socket Firewall Free: ${safeText(report.firewall?.path ?? 'not found; install the native sfw binary or specify --sfw')}`,
    ...report.issues.map(code => `[${safeText(code)}]`),
    ...(report.metadata.candidate ? [`Published: ${safeText(report.metadata.candidate.publishedAt ?? 'unknown')}; support: unknown`] : []),
    ...(report.execution ? [`Firewall/npm exit: ${report.execution.code ?? 'unavailable'}`,
      `Untrusted tool stdout: ${safeText(report.execution.stdout)}`, `Untrusted tool stderr: ${safeText(report.execution.stderr)}`] : []),
    ...report.limitations.map(safeText),
  ].join('\n') + '\n';
  if (report.kind === 'graph-review-report') return [
    `Decision: REVIEW (supplied proposal; graph collection: ${report.status})`,
    supportLine(report.preflight.toolchain),
    `Automatic resolution: unavailable (${report.resolution.reason})`,
    `Snapshot: ${safeText(report.snapshotDirectory ?? 'not created')}`,
    `Instances: ${report.baseline?.instances.length ?? 0} baseline -> ${report.candidate?.instances.length ?? 0} candidate`,
    ...report.declarationChanges.map(d => `Declaration ${safeText(d.field)}.${safeText(d.key)}: ${safeText(d.before ?? 'absent')} -> ${safeText(d.after ?? 'absent')}`),
    ...report.changes.map(d => `Graph ${safeText(d.path)}: ${d.kinds.join(', ')}; ${safeText(d.before?.version ?? 'absent')} -> ${safeText(d.after?.version ?? 'absent')}`),
    ...report.releases.flatMap(r => [`Release ${safeText(r.name)}@${safeText(r.version)}: ${r.status}; age seconds: ${r.ageSeconds ?? 'unknown'}; paths: ${r.paths.map(safeText).join(', ')}`,
      ...r.issues.map(code => `[${safeText(code)}] ${safeText(r.name)}@${safeText(r.version)}`)]),
    ...['baseline', 'candidate'].flatMap(k => (report[k]?.issues ?? []).map(i => `[${k}:${safeText(i.code)}] ${safeText(i.path)}`)),
    ...report.issues.map(i => `[${safeText(i.code)}] ${safeText(i.path)}`),
    ...report.preflight.issues.map(i => `[preflight:${safeText(i.code)}] ${safeText(i.message)}`),
    'Installation authorization: none.', ...report.limitations.map(safeText),
  ].join('\n') + '\n';
  if (report.kind === 'metadata-review-report') return [
    'Decision: REVIEW (partial live metadata evidence; no installation approval)',
    supportLine(report.preflight.toolchain),
    `Metadata collection: ${report.status}; package: ${safeText(report.requested.publicPackage)}@${safeText(report.requested.version)}`,
    `Source: ${safeText(report.source ?? 'not queried')}; checked: ${report.checkedAt}; expires: ${report.expiresAt}`,
    `Baseline: ${safeText(report.baselineSelection.version ?? 'none')} (${safeText(report.baselineSelection.reason)})`,
    ...['baseline', 'candidate'].filter(k => report[k]).map(k => `${k}: ${safeText(report[k].version)}; published: ${safeText(report[k].publishedAt ?? 'unknown')}; age seconds: ${report[k].ageSeconds ?? 'unknown'}; channel: ${report[k].channel}; support: unknown`),
    ...report.deltas.map(d => `${safeText(d.field)}.${safeText(d.key)} [${d.change}]: ${safeText(d.before ?? 'absent')} -> ${safeText(d.after ?? 'absent')}`),
    ...report.issues.map(i => `[${safeText(i.code)}] ${safeText(i.subject)}`),
    ...report.preflight.issues.map(i => `[preflight:${safeText(i.code)}] ${safeText(i.message)}`),
    'Installation authorization: none.', ...report.limitations.map(safeText),
  ].join('\n') + '\n';
  if (report.kind === 'preflight-report') return [
    `Preflight: ${report.status} (live read-only inspection; no package approval)`,
    `Manager: ${safeText(report.intendedManager)}; npm ${safeText(report.toolchain.npmVersion ?? 'unavailable')}; Node ${safeText(report.toolchain.nodeVersion)}`,
    supportLine(report.toolchain),
    `Operation: ${report.operation}; protection mode: ${report.protectionMode}`,
    `Effective cutoff: ${safeText(report.cutoff.effectiveBefore ?? 'none')} (${safeText(report.cutoff.source ?? 'none')})`,
    ...report.settings.map(s => `${safeText(s.key)}: ${safeText(s.value ?? 'unset')} [${safeText(s.source)}]`),
    ...report.issues.map(i => `[${safeText(i.code)}] ${safeText(i.message)}`),
    'Installation authorization: none.', ...report.limitations.map(safeText),
  ].join('\n') + '\n';
  const lines = report.kind === 'inspection-report'
    ? [`Inspection: ${report.status} (supplied evidence only; no package approval)`,
      `Manager: ${safeText(report.manager.name)} ${safeText(report.manager.version)}`, ...report.issues]
    : [`Decision: ${report.decision} (supplied evidence only)`, `Review: ${safeText(report.reviewId)}`,
      `Expires: ${report.expiresAt}`,
      `Manager: ${safeText(report.evidence.project.manager.name)} ${safeText(report.evidence.project.manager.version)}; protections: ${report.evidence.project.protectionsMode}`,
      ...report.evidence.artifacts.map(a => {
        const published = instant(a.publishedAt), evaluated = instant(report.evaluatedAt);
        const age = published === null || published > evaluated ? 'unknown' : `${((evaluated - published) / 86400000).toFixed(2)} days`;
        return `Package: ${safeText(a.name)}@${safeText(a.version)}; age: ${age}; channel: ${a.releaseChannel}; support: ${a.support}; registry: ${safeText(a.registry)}`;
      }),
      `Evidence: ${report.coverage.filter(c => c.status === 'complete').length}/${report.coverage.length} required checks complete; source details retained in JSON.`,
      ...report.reasons.map(r => `[${r.code}] ${safeText(r.subject)}: ${safeText(r.message)}${r.exceptionId ? ` (exception ${safeText(r.exceptionId)})` : ''}`),
      ...report.rejectedExceptions.map(x => `Exception ${safeText(x.id)} unused: ${safeText(x.reason)}`)];
  return [...lines, 'Installation authorization: none.', ...report.limitations.map(safeText)].join('\n') + '\n';
}
export function renderJson(report) {
  return JSON.stringify(report, null, 2).replace(/[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
}
