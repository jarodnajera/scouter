#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { evaluate, inspect } from './policy/evaluate.mjs';
import { renderJson, renderText, safeText } from './report/render.mjs';
import { ValidationError, validate } from './evidence/validate.mjs';
import { errorSchema } from '../schemas/v1.mjs';
import { preflight } from './adapters/npm/preflight.mjs';
import { reviewMetadata } from './adapters/npm/review-metadata.mjs';
import { compareProject } from './adapters/npm/compare.mjs';
import { dependencyWorkflow } from './workflow.mjs';

const help = `Hardhat review 0.1.0 — offline evidence evaluation, not an installation gate.
Primary workflow (Socket Firewall Free; no API token):
  node src/cli.mjs check --project DIR --public-package NAME --version EXACT [--sfw ABSOLUTE_PATH] [--format json|text]
  node src/cli.mjs install --project DIR --public-package NAME --version EXACT [--sfw ABSOLUTE_PATH] [--dev true|false] [--format json|text]
Live commands accept --experimental-macos true on macOS arm64/x64 (unverified).
Node 24.22.0 and npm 11.19.1 are required; Windows x64 remains validated.
check is read-only. install reruns checks and mutates the project through sfw with scripts disabled.
READY is eligibility for an install attempt, not a clean security scan. Keep your separate audit workflow.

Optional advanced diagnostics:
Usage:
  node src/cli.mjs review --evidence FILE [--exceptions FILE] [--at UTC] [--format json|text]
  node src/cli.mjs inspect --evidence FILE [--at UTC] [--format json|text]
  node src/cli.mjs inspect --project DIR [--npm-cli PATH] [--npm-options FILE]
    [--operation resolution|locked-install|runner] [--format json|text]
  node src/cli.mjs review --project DIR --public-package NAME --version EXACT
    [--dependency ALIAS] [--npm-cli PATH] [--npm-options FILE] [--format json|text]
  node src/cli.mjs compare --project DIR [--candidate-manifest FILE --candidate-lock FILE]
    [--baseline-lock FILE] [--public-packages FILE] [--npm-cli PATH] [--npm-options FILE] [--format json|text]

--at uses a UTC timestamp for reproducible fixture tests; otherwise the current time is used.
inspect --project reads live npm protection configuration without running project commands.
--npm-options is a JSON array of proposed --key=value protection flags, never an executed command.
--public-package explicitly permits lookup of that name at the public npm registry.
Live review collects metadata and compares published manifests; it always returns REVIEW.
compare inspects supplied proposals; automatic resolution is unavailable without qualified isolation.
--public-packages is a JSON array explicitly permitting public lookups for those graph package names.
The primary install workflow uses sfw; advanced diagnostics do not install. Exceptions are unauthenticated review records.
Exit codes: review PASS=0, REVIEW=2, BLOCK=3; invalid input/internal error=4.
Inspection complete=0, review/unsupported=2; neither grants approval.
`;
async function readJson(path) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new ValidationError('Input must be a regular JSON file no larger than 4 MiB');
    const bytes = Buffer.alloc(4 * 1024 * 1024 + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > 4 * 1024 * 1024) throw new ValidationError('Input exceeds 4 MiB');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
  } finally { await handle.close(); }
}
function parse(args) {
  const command = args[0];
  if (!['review', 'inspect', 'compare'].includes(command)) throw new ValidationError('Expected review, inspect, or compare');
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--experimental-macos', '--evidence', '--exceptions', '--at', '--format', '--project', '--npm-cli', '--npm-options', '--operation', '--public-package', '--version', '--dependency', '--candidate-manifest', '--candidate-lock', '--baseline-lock', '--public-packages'].includes(key) || !value || value.startsWith('--') || Object.hasOwn(options, key)) {
      throw new ValidationError('Unknown, duplicate, or incomplete option');
    }
    options[key] = value;
  }
  const live = options['--project'];
  if (options['--experimental-macos'] !== undefined && (!live || !['true', 'false'].includes(options['--experimental-macos']))) throw new ValidationError('--experimental-macos requires a live command and true or false');
  const comparisonOptions = ['--candidate-manifest', '--candidate-lock', '--baseline-lock', '--public-packages'];
  if (command !== 'compare' && comparisonOptions.some(k => options[k])) throw new ValidationError('Proposal options require compare');
  if (command === 'compare' && (!live || ['--public-package', '--version', '--dependency', '--operation'].some(k => options[k]))) throw new ValidationError('Compare requires --project and proposal options only');
  if (live) {
    if (options['--evidence'] || options['--exceptions'] || options['--at']) throw new ValidationError('Live preflight cannot use evidence, exceptions, or a simulated clock');
    if (command === 'review' && (!options['--public-package'] || !options['--version'] || options['--operation'])) throw new ValidationError('Live review requires --public-package and --version; operation is resolution');
    if (command === 'inspect' && ['--public-package', '--version', '--dependency'].some(k => options[k])) throw new ValidationError('Package options require live review');
  } else {
    if (!options['--evidence']) throw new ValidationError('--evidence is required');
    if (['--project', '--npm-cli', '--npm-options', '--operation', '--public-package', '--version', '--dependency'].some(k => options[k])) throw new ValidationError('Project options require live inspection or review');
  }
  if (options['--format'] && !['json', 'text'].includes(options['--format'])) throw new ValidationError('Expected json or text format');
  if (command === 'inspect' && options['--exceptions']) throw new ValidationError('Exceptions apply only to review');
  return { command, options };
}
let format = 'json';
function workflowOptions(args) {
  const values = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--project', '--public-package', '--version', '--sfw', '--npm-cli', '--format', '--dev', '--experimental-macos'].includes(key)
      || !value || value.startsWith('--') || Object.hasOwn(values, key)) throw new ValidationError('Unknown, duplicate, or incomplete workflow option');
    values[key] = value;
  }
  if (!values['--project'] || !values['--public-package'] || !values['--version']) throw new ValidationError('Project, public package and exact version are required');
  if (values['--format'] && !['json', 'text'].includes(values['--format'])) throw new ValidationError('Expected json or text');
  if (values['--dev'] && !['true', 'false'].includes(values['--dev'])) throw new ValidationError('Expected --dev true or false');
  if (values['--experimental-macos'] !== undefined && !['true', 'false'].includes(values['--experimental-macos'])) throw new ValidationError('Expected --experimental-macos true or false');
  format = values['--format'] ?? 'json';
  return { install: args[0] === 'install', project: values['--project'], publicPackage: values['--public-package'],
    version: values['--version'], sfw: values['--sfw'], npmCli: values['--npm-cli'], dev: values['--dev'] === 'true', experimentalMacos: values['--experimental-macos'] === 'true' };
}
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) process.stdout.write(help);
  else if (['check', 'install'].includes(args[0])) {
    const report = await dependencyWorkflow(workflowOptions(args));
    process.stdout.write(format === 'json' ? renderJson(report) : renderText(report));
    process.exitCode = ['ready', 'completed'].includes(report.status) ? 0 : 2;
  }
  else {
    const { command, options } = parse(args);
    format = options['--format'] ?? 'json';
    let report;
    if (options['--project']) {
      const liveOptions = { experimentalMacos: options['--experimental-macos'] === 'true', project: options['--project'], npmCli: options['--npm-cli'],
        npmFlags: options['--npm-options'] ? await readJson(options['--npm-options']) : [],
        operation: options['--operation'] ?? 'resolution' };
      report = command === 'compare' ? await compareProject({ ...liveOptions, candidateManifest: options['--candidate-manifest'],
        candidateLock: options['--candidate-lock'], baselineLock: options['--baseline-lock'],
        publicPackages: options['--public-packages'] ? await readJson(options['--public-packages']) : [] })
        : command === 'review' ? await reviewMetadata({ ...liveOptions, publicPackage: options['--public-package'],
        version: options['--version'], dependency: options['--dependency'] ?? options['--public-package'] }) : await preflight(liveOptions);
    } else {
      const evidence = await readJson(options['--evidence']);
      const settings = { now: options['--at'] ?? new Date().toISOString() };
      if (options['--exceptions']) settings.exceptions = await readJson(options['--exceptions']);
      report = command === 'inspect' ? inspect(evidence, settings) : evaluate(evidence, settings);
    }
    process.stdout.write(format === 'json' ? renderJson(report) : renderText(report));
    process.exitCode = command === 'inspect' ? (report.status === 'complete' ? 0 : 2)
      : { PASS: 0, REVIEW: 2, BLOCK: 3 }[report.decision];
  }
} catch (error) {
  const invalid = error instanceof ValidationError || error instanceof SyntaxError || error instanceof TypeError
    || ['ENOENT', 'EACCES', 'EPERM', 'EISDIR'].includes(error.code);
  const report = validate(errorSchema, { schemaVersion: '1.0.0', toolVersion: '0.1.0', kind: 'error-report',
    code: invalid ? 'INVALID_INPUT' : 'INTERNAL_ERROR',
    message: error instanceof ValidationError ? error.message : invalid ? 'Unable to read valid evidence input.' : 'Evaluation failed; no usable decision.',
    authorization: 'none' });
  process.stdout.write(format === 'json' ? renderJson(report) : renderText(report));
  process.stderr.write(`${safeText(report.code)}: ${safeText(report.message)}\n`);
  process.exitCode = 4;
}
