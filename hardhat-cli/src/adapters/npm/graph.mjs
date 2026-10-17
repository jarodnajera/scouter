import { createRequire } from 'node:module';
import { realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { packageName, exactVersion, REGISTRY } from './registry.mjs';
import { canonical, hash } from '../../evidence/canonical.mjs';
import { ValidationError } from '../../evidence/validate.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'];
const fail = () => { throw new ValidationError('Unsupported or malformed graph input'); };
export async function loadSemver(npmCli) {
  const root = await realpath(resolve(dirname(npmCli), '..'));
  const req = createRequire(resolve(root, 'package.json'));
  const path = await realpath(req.resolve('semver'));
  const rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel)) fail();
  return req('semver'); // Already installed npm dependency, not project module resolution.
}
export function dependencySpec(key, spec, semver) {
  if (!packageName(key) || typeof spec !== 'string' || spec.length > 1024) return null;
  let name = key, range = spec;
  if (spec.startsWith('npm:')) {
    const match = /^npm:((?:@[^/]+\/)?[^@]+)@(.+)$/.exec(spec);
    if (!match || !packageName(match[1])) return null;
    name = match[1]; range = match[2];
  }
  // No tag, URL, Git, local path or workspace resolution during graph inspection.
  if (semver.validRange(range) === null) return null;
  return { name, range };
}
function declarations(record, root = false) {
  const output = [];
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) continue;
    const map = record[field];
    if (!object(map) || Object.keys(map).length > 2000) fail();
    for (const [name, spec] of Object.entries(map).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      if (!packageName(name)) fail();
      if (field === 'peerDependenciesMeta') {
        if (!object(spec) || Object.keys(spec).some(k => k !== 'optional') || typeof spec.optional !== 'boolean') fail();
        continue;
      }
      if (typeof spec !== 'string' || spec.length > 1024) fail();
      if (field === 'devDependencies' && !root) continue;
      if (field === 'dependencies' && Object.hasOwn(record.optionalDependencies ?? {}, name)) continue;
      output.push({ name, spec, type: field, optional: field === 'optionalDependencies'
        || (field === 'peerDependencies' && record.peerDependenciesMeta?.[name]?.optional === true) });
    }
  }
  return output;
}
export function sanitizeManifest(manifest) {
  if (!object(manifest) || !packageName(manifest.name) || !exactVersion(manifest.version)) fail();
  declarations(manifest, true);
  return Object.fromEntries(['name', 'version', ...fields].filter(k => Object.hasOwn(manifest, k)).map(k => [k, structuredClone(manifest[k])]));
}
function pathName(path) {
  if (typeof path !== 'string' || path.length > 4096 || path.includes('\\')) return null;
  const pieces = path.split(/(?:^|\/)node_modules\//);
  return pieces[0] === '' && pieces.length <= 65 && pieces.slice(1).every(packageName) ? pieces.at(-1) : null;
}
const parent = path => { const at = path.lastIndexOf('/node_modules/'); return at < 0 ? '' : path.slice(0, at); };
function targetPath(nodes, from, name, peer) {
  let base = peer ? parent(from) : from;
  for (;;) {
    const candidate = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (nodes.has(candidate)) return candidate;
    if (!base) return null;
    base = parent(base);
  }
}
function registryOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
// Match npm-install-checks list semantics; libc alone is not enough to exclude a node.
function matchesPlatform(value, values) {
  if (!values.length || (values.length === 1 && values[0] === 'any')) return true;
  if (values.includes(`!${value}`)) return false;
  return values.every(v => v.startsWith('!')) || values.includes(value);
}
function bundledNames(record) {
  const parse = value => {
    if (value === undefined || value === false) return [];
    if (value === true) return [...new Set([...Object.keys(record.dependencies ?? {}), ...Object.keys(record.optionalDependencies ?? {})])];
    if (!Array.isArray(value) || value.length > 2000 || value.some(v => !packageName(v)) || new Set(value).size !== value.length) fail();
    return [...value].sort();
  };
  const a = parse(record.bundleDependencies), b = parse(record.bundledDependencies);
  if (record.bundleDependencies !== undefined && record.bundledDependencies !== undefined && canonical([...a].sort()) !== canonical([...b].sort())) fail();
  return new Set(record.bundleDependencies !== undefined ? a : b);
}
export function normalizeGraph(manifest, lock, semver, target = null) {
  const safe = sanitizeManifest(manifest);
  if (!object(lock) || lock.lockfileVersion !== 3 || !object(lock.packages) || !object(lock.packages[''])
    || Object.keys(lock.packages).length > 10001) fail();
  const issues = [], add = (code, path) => issues.push({ code, path });
  const root = lock.packages[''];
  if (root.name !== manifest.name || root.version !== manifest.version) add('MANIFEST_LOCK_MISMATCH', '');
  for (const field of fields) if (canonical(root[field] ?? {}) !== canonical(manifest[field] ?? {})) add('MANIFEST_LOCK_MISMATCH', '');
  for (const record of [manifest, root]) {
    if (record.workspaces !== undefined || record.overrides !== undefined || record.resolutions !== undefined
      || record.bundleDependencies !== undefined || record.bundledDependencies !== undefined) add('UNSUPPORTED_ROOT_CONFIGURATION', '');
  }
  const nodes = new Map(), entries = new Map();
  for (const path of Object.keys(lock.packages).filter(Boolean).sort()) {
    const installedAs = pathName(path), entry = lock.packages[path];
    if (!installedAs || !object(entry) || !exactVersion(entry.version)) fail();
    const name = entry.name ?? installedAs;
    if (!packageName(name)) fail();
    const origin = registryOrigin(entry.resolved);
    if (entry.link || entry.inBundle || entry.hasShrinkwrap || origin !== REGISTRY.slice(0, -1)) add('UNSUPPORTED_PACKAGE_SOURCE', path);
    if (typeof entry.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity)) add('INTEGRITY_EVIDENCE_INVALID', path);
    for (const key of ['dev', 'optional', 'devOptional', 'peer', 'hasInstallScript']) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') fail();
    const conditions = {};
    for (const key of ['os', 'cpu', 'libc']) {
      const values = entry[key] ?? [];
      if (!Array.isArray(values) || values.length > 100 || values.some(v => typeof v !== 'string' || v.length > 256)) fail();
      conditions[key] = values;
    }
    if (entry.engines !== undefined && (!object(entry.engines) || Object.keys(entry.engines).length > 100
      || Object.values(entry.engines).some(v => typeof v !== 'string' || v.length > 1024))) fail();
    const engines = Object.entries(entry.engines ?? {}).sort().map(([name, range]) => ({ name, range }));
    const node = { path, installedAs, name, version: entry.version, origin,
      resolved: origin === REGISTRY.slice(0, -1) ? entry.resolved : null,
      integrity: typeof entry.integrity === 'string' && entry.integrity.length <= 1024 ? entry.integrity : null,
      dev: entry.dev === true, optional: entry.optional === true, devOptional: entry.devOptional === true,
      peer: entry.peer === true, hasInstallScript: entry.hasInstallScript === true, conditions, engines,
      direct: false, parentPaths: [], reachable: false };
    entries.set(path, entry); nodes.set(path, node);
  }
  const edges = [];
  for (const [from, record] of [['', safe], ...entries]) {
    for (const declaration of declarations(record, from === '')) {
      if (edges.length >= 40000) fail();
      const spec = dependencySpec(declaration.name, declaration.spec, semver);
      if (!spec) add('UNSUPPORTED_DEPENDENCY_SPEC', from);
      const target = targetPath(nodes, from, declaration.name, declaration.type === 'peerDependencies');
      const node = nodes.get(target);
      if (node && spec) {
        if (node.name !== spec.name) add('ALIAS_IDENTITY_MISMATCH', target);
        if (!semver.satisfies(node.version, spec.range)) add('DEPENDENCY_RANGE_MISMATCH', target);
      }
      if (node) { node.parentPaths.push(from); if (!from) node.direct = true; }
      edges.push({ from, to: target, dependency: declaration.name, spec: spec ? declaration.spec : '[unsupported specification withheld]',
        type: declaration.type, optional: declaration.optional });
    }
  }
  // Bundled contents are not necessarily separate lock entries. Do not invent
  // their versions or claim coverage. Only a proven optional platform exclusion
  // may make that coverage irrelevant to the live operation.
  const incoming = new Map();
  for (const edge of edges) if (edge.to !== null) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  const bundles = new Map();
  for (const [path, record] of entries) {
    const names = bundledNames(record); bundles.set(path, names);
    if (!names.size) continue;
    const node = nodes.get(path), parents = incoming.get(path) ?? [];
    const excluded = target && typeof target.platform === 'string' && typeof target.arch === 'string'
      && node.optional && parents.length > 0 && parents.every(e => e.optional)
      && (!matchesPlatform(target.platform, node.conditions.os) || !matchesPlatform(target.arch, node.conditions.cpu));
    add(excluded ? 'EXCLUDED_OPTIONAL_BUNDLE' : 'BUNDLED_DEPENDENCIES_UNVERIFIED', path);
  }
  for (const edge of edges) if (edge.to === null && !edge.optional) {
    const bundled = edge.type === 'dependencies' && bundles.get(edge.from)?.has(edge.dependency);
    if (!bundled) add('MISSING_DEPENDENCY', edge.from);
  }
  const adjacency = new Map();
  for (const edge of edges) { if (!adjacency.has(edge.from)) adjacency.set(edge.from, []); if (edge.to !== null) adjacency.get(edge.from).push(edge.to); }
  const queue = [''], visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) for (const path of adjacency.get(queue[i]) ?? []) {
    if (!visited.has(path)) { visited.add(path); queue.push(path); }
  }
  for (const node of nodes.values()) {
    node.parentPaths = [...new Set(node.parentPaths)].sort(); node.reachable = visited.has(node.path);
    if (!node.reachable) add('UNREACHABLE_INSTANCE', node.path);
  }
  const instances = [...nodes.values()];
  return { instances, edges, digest: hash({ instances, edges }), issues };
}
export function compareGraphs(before, after, semver) {
  const old = new Map(before.instances.map(n => [n.path, n])), next = new Map(after.instances.map(n => [n.path, n]));
  const outgoing = graph => {
    const map = new Map();
    for (const edge of graph.edges) { if (!map.has(edge.from)) map.set(edge.from, []); map.get(edge.from).push(edge); }
    return map;
  };
  const oldEdges = outgoing(before), newEdges = outgoing(after);
  const changes = [];
  for (const path of [...new Set([...old.keys(), ...next.keys()])].sort()) {
    const a = old.get(path) ?? null, b = next.get(path) ?? null, kinds = [];
    if (!a) kinds.push('added'); else if (!b) kinds.push('removed'); else {
      if (a.name !== b.name) kinds.push('identity-changed');
      if (a.version !== b.version) { const order = semver.compare(a.version, b.version); kinds.push(order < 0 ? 'upgraded' : order > 0 ? 'downgraded' : 'version-changed'); }
      if (a.origin !== b.origin) kinds.push('origin-changed');
      if (a.resolved !== b.resolved) kinds.push('resolved-changed');
      if (a.integrity !== b.integrity) kinds.push('integrity-changed');
      if (canonical(oldEdges.get(path) ?? []) !== canonical(newEdges.get(path) ?? [])) kinds.push('edges-changed');
      if (canonical({ ...a, version: '', name: '', origin: '', resolved: '', integrity: '' })
        !== canonical({ ...b, version: '', name: '', origin: '', resolved: '', integrity: '' })) kinds.push('context-changed');
    }
    if (kinds.length) changes.push({ path, kinds, before: a, after: b });
  }
  return changes;
}
export function compareDeclarations(a, b, semver) {
  const out = [];
  for (const field of fields) for (const key of [...new Set([...Object.keys(a[field] ?? {}), ...Object.keys(b[field] ?? {})])].sort()) {
    const value = record => !Object.hasOwn(record[field] ?? {}, key) ? null : canonical(
      semver && field !== 'peerDependenciesMeta' && !dependencySpec(key, record[field][key], semver)
        ? '[unsupported specification withheld]' : record[field][key]);
    const before = value(a), after = value(b);
    if (before !== after) out.push({ field, key, before, after });
  }
  return out;
}
