import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createMetadataClient } from '../../src/adapters/npm/registry.mjs';

async function fixture(t, handler, limits = {}) {
  const seen = [], server = createServer((req, res) => { seen.push({ url: req.url, headers: req.headers }); handler(req, res, seen.length); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = createMetadataClient({ retryDelayMs: 1, ...limits, request: (url, options, callback) => {
    assert.equal(url.origin, 'https://registry.npmjs.org'); assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.agent, false); assert.equal(typeof options.lookup, 'function');
    return httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: url.pathname,
      method: options.method, headers: options.headers, agent: false }, callback);
  } });
  return { client, seen };
}
test('bounded HTTP collector encodes scopes and sends no credentials or project data', async t => {
  const f = await fixture(t, (req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"name":"@scope/demo"}'); });
  const r = await f.client('@scope/demo'); assert.equal(r.document.name, '@scope/demo');
  assert.equal(f.seen[0].url, '/%40scope%2Fdemo'); assert.equal(r.attempts, 1);
  assert.deepEqual(Object.keys(f.seen[0].headers).sort(), ['accept', 'accept-encoding', 'connection', 'host', 'user-agent']);
});
test('redirects are rejected without contacting the target', async t => {
  const f = await fixture(t, (req, res) => { res.writeHead(302, { location: 'http://169.254.169.254/secrets' }); res.end(); });
  await assert.rejects(f.client('demo'), /REGISTRY_REDIRECT_REJECTED/); assert.equal(f.seen.length, 1);
});
test('temporary failures retry at most once; then return evidence failure', async t => {
  const f = await fixture(t, (req, res) => { res.writeHead(503); res.end('secret diagnostic'); });
  await assert.rejects(f.client('demo'), e => e.code === 'REGISTRY_TEMPORARY_FAILURE' && e.attempts === 2 && !e.message.includes('secret'));
  assert.equal(f.seen.length, 2);
});
test('retry can recover without changing destination', async t => {
  const f = await fixture(t, (req, res, count) => { res.writeHead(count === 1 ? 429 : 200, { 'content-type': 'application/json' }); res.end('{}'); });
  assert.equal((await f.client('demo')).attempts, 2); assert.equal(f.seen[0].url, f.seen[1].url);
});
test('404 is unavailable, not withdrawn or a clean empty response', async t => {
  const f = await fixture(t, (req, res) => { res.writeHead(404); res.end('{}'); });
  await assert.rejects(f.client('demo'), /PACKAGE_NOT_FOUND/); assert.equal(f.seen.length, 1);
});
test('invalid JSON, content type and compression fail closed', async t => {
  for (const [headers, body, code] of [[{ 'content-type': 'application/json' }, '{', 'REGISTRY_INVALID_JSON'],
    [{ 'content-type': 'text/html' }, '{}', 'REGISTRY_CONTENT_TYPE'],
    [{ 'content-type': 'application/json', 'content-encoding': 'gzip' }, '{}', 'REGISTRY_ENCODING_REJECTED']]) {
    const f = await fixture(t, (req, res) => { res.writeHead(200, headers); res.end(body); });
    await assert.rejects(f.client('demo'), new RegExp(code));
  }
});
test('oversized declared and streamed bodies are stopped', async t => {
  for (const declared of [true, false]) {
    const f = await fixture(t, (req, res) => { res.setHeader('content-type', 'application/json');
      if (declared) res.setHeader('content-length', '1000'); res.write('x'.repeat(100)); res.end(); }, { maxBytes: 32 });
    await assert.rejects(f.client('demo'), /REGISTRY_RESPONSE_TOO_LARGE/);
  }
});
test('absolute deadline stops a hung response with bounded retry', async t => {
  const f = await fixture(t, () => {}, { timeoutMs: 25 });
  await assert.rejects(f.client('demo'), /REGISTRY_TIMEOUT/); assert.equal(f.seen.length, 2);
});
test('invalid package input causes zero requests', async t => {
  const f = await fixture(t, () => {});
  await assert.rejects(f.client('demo?token=secret'), /INVALID_PACKAGE_NAME/); assert.equal(f.seen.length, 0);
});
