import { createHash } from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export const same = (a, b) => canonical(a) === canonical(b);
export function graphDigest(evidence) {
  return hash({ artifacts: evidence.artifacts.map(({ id, ecosystem, name, version, registry, resolved, integrity }) =>
    ({ id, ecosystem, name, version, registry, resolved, integrity })).sort(byId),
  instances: evidence.instances.map(i => ({ ...i, parentIds: [...i.parentIds].sort() }))
    .sort(byId) });
}
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
// Strict UTC instants; invalid calendar dates must not normalize silently.
export function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString() === value.replace(/(?<!\.\d{3})Z$/, '.000Z') ? time : null;
}
