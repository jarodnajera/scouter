import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns';

export const REGISTRY = 'https://registry.npmjs.org/';
export class MetadataError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export const packageName = value => typeof value === 'string' && value.length <= 214
  && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
// Exact canonical SemVer only; range resolution and ordering are not implemented here.
export const exactVersion = value => typeof value === 'string' && value.length <= 256
  && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);

export function publicIPv4(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}
function publicLookup(host, options, callback) {
  if (host !== 'registry.npmjs.org') return callback(new MetadataError('REGISTRY_ORIGIN_REJECTED'));
  lookup(host, { family: 4, all: true }, (error, records) => {
    if (error) return callback(error);
    if (!records.length || records.some(r => !publicIPv4(r.address))) return callback(new MetadataError('REGISTRY_ADDRESS_REJECTED'));
    if (options.all) callback(null, records);
    else callback(null, records[0].address, 4);
  });
}

// Transport injection is a trusted test seam, never a CLI/project option.
export function createMetadataClient({ request = httpsRequest, timeoutMs = 10000, maxBytes = 16 * 1024 * 1024,
  retryDelayMs = 100 } = {}) {
  const once = url => new Promise((resolve, reject) => {
    let settled = false, timer, req;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) { req?.destroy(); reject(error); } else resolve(value);
    };
    try {
      req = request(url, { method: 'GET', agent: false, lookup: publicLookup, family: 4,
        rejectUnauthorized: true, maxHeaderSize: 16384,
        headers: { accept: 'application/json', 'accept-encoding': 'identity', 'user-agent': 'scouter-review/0.1.0' } }, res => {
        const fail = code => { finish(new MetadataError(code)); res.destroy(); };
        if (res.statusCode >= 300 && res.statusCode < 400) return fail('REGISTRY_REDIRECT_REJECTED');
        if (res.statusCode === 404) return fail('PACKAGE_NOT_FOUND');
        if (res.statusCode === 429 || res.statusCode >= 500) return fail('REGISTRY_TEMPORARY_FAILURE');
        if (res.statusCode !== 200) return fail('REGISTRY_HTTP_FAILURE');
        if (!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] ?? '')) return fail('REGISTRY_CONTENT_TYPE');
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') return fail('REGISTRY_ENCODING_REJECTED');
        if (Number(res.headers['content-length']) > maxBytes) return fail('REGISTRY_RESPONSE_TOO_LARGE');
        const chunks = []; let size = 0;
        res.on('error', () => finish(new MetadataError('REGISTRY_NETWORK_FAILURE')));
        res.on('aborted', () => finish(new MetadataError('REGISTRY_NETWORK_FAILURE')));
        res.on('data', chunk => { size += chunk.length; if (size > maxBytes) fail('REGISTRY_RESPONSE_TOO_LARGE'); else chunks.push(chunk); });
        res.on('end', () => {
          if (settled) return;
          try {
            const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
            finish(null, JSON.parse(body));
          } catch { finish(new MetadataError('REGISTRY_INVALID_JSON')); }
        });
      });
      req.on('error', error => finish(new MetadataError(error instanceof MetadataError ? error.code : 'REGISTRY_NETWORK_FAILURE')));
      timer = setTimeout(() => finish(new MetadataError('REGISTRY_TIMEOUT')), timeoutMs);
      req.end();
    } catch { finish(new MetadataError('REGISTRY_NETWORK_FAILURE')); }
  });
  return async name => {
    if (!packageName(name)) throw new MetadataError('INVALID_PACKAGE_NAME');
    const url = new URL(encodeURIComponent(name), REGISTRY);
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return { document: await once(url), source: url.href, attempts: attempt }; }
      catch (error) {
        error.attempts = attempt;
        if (attempt === 2 || !['REGISTRY_TEMPORARY_FAILURE', 'REGISTRY_NETWORK_FAILURE', 'REGISTRY_TIMEOUT'].includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  };
}
