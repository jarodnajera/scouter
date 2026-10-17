import { MetadataError, packageName, exactVersion, REGISTRY } from './registry.mjs';
import { instant, canonical } from '../../evidence/canonical.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = v => typeof v === 'string' && v.length <= 8192;
const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta',
  'scripts', 'bin', 'engines', 'os', 'cpu', 'libc', 'gypfile', 'bundleDependencies', 'bundledDependencies'];
function boundedValue(v, depth = 0) {
  if (depth > 8) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'string') return string(v);
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= 1000 && v.every(x => boundedValue(x, depth + 1));
  return object(v) && Object.keys(v).length <= 1000 && Object.entries(v).every(([k, x]) => string(k) && boundedValue(x, depth + 1));
}
function entries(manifest) {
  const result = [];
  for (const field of fields) {
    if (!Object.hasOwn(manifest, field)) continue;
    const value = manifest[field];
    if (!boundedValue(value)) throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts', 'engines'].includes(field)) {
      if (!object(value) || !Object.values(value).every(string)) throw new MetadataError('METADATA_SCHEMA_INVALID');
      if (field.endsWith('Dependencies') || field === 'dependencies') {
        if (!Object.keys(value).every(packageName)) throw new MetadataError('METADATA_SCHEMA_INVALID');
      }
    }
    if (field === 'bin' && !(string(value) || (object(value) && Object.values(value).every(string)))) throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (['os', 'cpu', 'libc'].includes(field) && !(Array.isArray(value) && value.every(string))) throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (field === 'gypfile' && typeof value !== 'boolean') throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (['bundleDependencies', 'bundledDependencies'].includes(field) && !(typeof value === 'boolean' || (Array.isArray(value) && value.every(packageName)))) throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (field === 'peerDependenciesMeta' && (!object(value) || !Object.entries(value).every(([k, v]) => packageName(k) && object(v) && typeof v.optional === 'boolean' && Object.keys(v).length === 1))) throw new MetadataError('METADATA_SCHEMA_INVALID');
    if (object(value)) {
      for (const key of Object.keys(value).sort()) {
        const encoded = canonical(value[key]);
        if (encoded.length > 8192) throw new MetadataError('METADATA_SCHEMA_INVALID');
        result.push({ field, key, value: encoded });
      }
    } else {
      const encoded = canonical(value);
      if (encoded.length > 8192) throw new MetadataError('METADATA_SCHEMA_INVALID');
      result.push({ field, key: '', value: encoded });
    }
  }
  return result;
}
const claim = value => {
  if (value === undefined) return null;
  if (!boundedValue(value) || canonical(value).length > 8192) throw new MetadataError('METADATA_SCHEMA_INVALID');
  return canonical(value);
};
export function normalizeRelease(document, name, version, now) {
  if (!object(document) || document.name !== name || !object(document.versions)
    || Object.keys(document.versions).length > 100000 || (document.time !== undefined && !object(document.time))) {
    throw new MetadataError('METADATA_SCHEMA_INVALID');
  }
  if (!Object.hasOwn(document.versions, version)) throw new MetadataError('VERSION_NOT_FOUND');
  const v = document.versions[version];
  if (!object(v) || v.name !== name || v.version !== version || !exactVersion(v.version)) throw new MetadataError('METADATA_IDENTITY_MISMATCH');
  if (v.deprecated !== undefined && !string(v.deprecated)) throw new MetadataError('METADATA_SCHEMA_INVALID');
  if (v.dist !== undefined && !object(v.dist)) throw new MetadataError('METADATA_SCHEMA_INVALID');
  if (['tarball', 'integrity', 'shasum'].some(k => v.dist?.[k] !== undefined && !string(v.dist[k]))) throw new MetadataError('METADATA_SCHEMA_INVALID');
  if (v._npmUser !== undefined && (!object(v._npmUser) || !string(v._npmUser.name))) throw new MetadataError('METADATA_SCHEMA_INVALID');
  if (v.maintainers !== undefined && (!Array.isArray(v.maintainers) || !v.maintainers.every(m => object(m) && string(m.name)))) throw new MetadataError('METADATA_SCHEMA_INVALID');
  if (v.repository !== undefined && !(string(v.repository) || (object(v.repository) && string(v.repository.url)))) throw new MetadataError('METADATA_SCHEMA_INVALID');
  const rawTime = document.time?.[version];
  const timestamp = instant(rawTime), current = instant(now);
  if (current === null) throw new MetadataError('INVALID_CLOCK');
  const issues = [];
  if (timestamp === null || timestamp > current) issues.push('PUBLISH_TIME_INVALID');
  const ageSeconds = timestamp === null || timestamp > current ? null : (current - timestamp) / 1000;
  if (ageSeconds !== null && ageSeconds < 604800) issues.push('AGE_TOO_RECENT');
  const channel = version.split('+')[0].includes('-') ? 'prerelease' : 'stable-version';
  if (channel === 'prerelease') issues.push('PRERELEASE');
  if (v.deprecated) issues.push('RELEASE_DEPRECATED');
  issues.push('SUPPORT_UNKNOWN', 'WITHDRAWAL_STATUS_UNKNOWN', 'IDENTITY_UNCORROBORATED', 'PROVENANCE_UNVERIFIED');
  issues.push('ARTIFACT_INTEGRITY_UNVERIFIED');
  try {
    const origin = new URL(v.dist?.tarball);
    if (origin.origin !== REGISTRY.slice(0, -1) || origin.username || origin.password || origin.search || origin.hash) issues.push('DIST_ORIGIN_UNSUPPORTED');
  } catch { issues.push('DIST_ORIGIN_UNKNOWN'); }
  const manifest = entries(v);
  if (manifest.some(e => ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'].includes(e.field)
    && (() => {
      const spec = JSON.parse(e.value);
      if (spec.startsWith('npm:')) {
        const alias = /^npm:((?:@[^/]+\/)?[^@]+)@([^:/\\]+)$/.exec(spec);
        return !alias || !packageName(alias[1]);
      }
      return /[:/\\]|^\./.test(spec);
    })())) issues.push('UNSUPPORTED_DEPENDENCY_SOURCE');
  return { name, version, publishedAt: string(rawTime) ? rawTime : null, ageSeconds, channel,
    deprecated: v.deprecated ?? null, support: 'unknown', withdrawn: 'unknown', manifest,
    claims: { repository: claim(v.repository), publisher: claim(v._npmUser), maintainers: claim(v.maintainers),
      integrity: claim(v.dist?.integrity), shasum: claim(v.dist?.shasum), tarball: claim(v.dist?.tarball),
      signatures: claim(v.dist?.signatures), attestations: claim(v.dist?.attestations),
      npmVersion: claim(v._npmVersion), nodeVersion: claim(v._nodeVersion) }, issues };
}
export function compareReleases(baseline, candidate) {
  if (!baseline || !candidate) return [];
  const index = r => new Map([...r.manifest.map(e => [`${e.field}\0${e.key}`, { ...e }]),
    ...Object.entries(r.claims).map(([key, value]) => [`identity\0${key}`, { field: 'identity', key, value }])]);
  const old = index(baseline), next = index(candidate), deltas = [];
  for (const key of [...new Set([...old.keys(), ...next.keys()])].sort()) {
    const before = old.get(key)?.value ?? null, after = next.get(key)?.value ?? null;
    if (before !== after) {
      const item = next.get(key) ?? old.get(key);
      deltas.push({ field: item.field, key: item.key, change: before === null ? 'added' : after === null ? 'removed' : 'changed', before, after });
    }
  }
  return deltas;
}
