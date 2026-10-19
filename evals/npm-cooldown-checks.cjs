// Opt-in offline checks against an explicitly selected, already installed npm.
// Usage: /absolute/node evals/npm-cooldown-checks.cjs /absolute/npm/package.json
// No acquisition, reify, Socket invocation, or application package code execution.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { spawnSync } = require('node:child_process')

assert(process.argv[2] && path.isAbsolute(process.argv[2]), 'Supply an absolute npm package.json')
const npmRequire = createRequire(process.argv[2])
const pick = npmRequire('npm-pick-manifest')
const pacote = npmRequire('pacote')
const Arborist = npmRequire('@npmcli/arborist')
const npmRoot = path.dirname(process.argv[2])
const cutoff = '2026-10-12T00:00:00.000Z'
const strictCutoff = '2026-10-01T00:00:00.000Z'
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scouter-npm-check-')))
const manifests = new Map()
const requests = []
let passed = 0

function pack(name, dependencies = {}) {
  return {
    name, 'dist-tags': { latest: '1.1.0' },
    versions: Object.fromEntries(['1.0.0', '1.1.0'].map(version => [version, {
      name, version, dependencies,
      dist: { tarball: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        integrity: 'sha512-' + Buffer.alloc(64).toString('base64') },
    }])),
    time: { '1.0.0': '2026-10-05T00:00:00Z', '1.1.0': '2026-10-17T00:00:00Z' },
  }
}
manifests.set('scouter-fixture-root', pack('scouter-fixture-root', { 'scouter-fixture-child': '^1.0.0' }))
manifests.set('scouter-fixture-child', pack('scouter-fixture-child'))
// Exercise Arborist's real option propagation and lock reuse, with metadata in memory.
pacote.manifest = async (spec, options) => {
  assert.equal(options.offline, true)
  requests.push({ name: spec.name, before: options.before })
  assert(manifests.has(spec.name), `Unexpected request: ${spec.name}`)
  const result = pick(manifests.get(spec.name), spec.rawSpec, options)
  return { ...result, _resolved: result.dist.tarball, _integrity: result.dist.integrity }
}
pacote.extract = async () => { throw Error('Artifact extraction is forbidden in this check') }

function project(name, pkg) {
  const folder = path.join(temp, name)
  fs.mkdirSync(folder)
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify(pkg))
  return folder
}
function options(folder, before = cutoff) {
  return { path: folder, before, offline: true, audit: false, ignoreScripts: true,
    cache: path.join(temp, 'cache'), packageLock: true }
}
async function check(name, action) {
  await action()
  passed++
  console.log(`PASS ${name}`)
}

async function main() {
  console.log(`Installed npm ${npmRequire('./package.json').version}; Node ${process.version}`)
  await check('fresh exact version rejected by installed resolver', () => {
    assert.throws(() => pick(manifests.get('scouter-fixture-root'), '1.1.0', { before: cutoff }),
      error => error.code === 'ETARGET')
  })
  await check('mature direct and transitive selected with cutoff propagated', async () => {
    const folder = project('resolve', { name: 'fixture', version: '1.0.0',
      dependencies: { 'scouter-fixture-root': '1.0.0' } })
    const tree = await new Arborist(options(folder)).buildIdealTree()
    assert.equal(tree.children.get('scouter-fixture-root').version, '1.0.0')
    assert.equal(tree.children.get('scouter-fixture-child').version, '1.0.0')
    assert(requests.some(r => r.name === 'scouter-fixture-child'))
    assert(requests.every(r => new Date(r.before).toISOString() === cutoff))
    assert(!fs.existsSync(path.join(folder, 'node_modules')))
  })
  await check('missing timestamps are admitted by resolver; independent verification is needed', () => {
    const p = pack('scouter-fixture-missing-time')
    delete p.time['1.1.0']
    assert.equal(pick(p, '1.1.0', { before: cutoff }).version, '1.1.0')
    delete p.time
    assert.equal(pick(p, '1.1.0', { before: cutoff }).version, '1.1.0')
  })
  await check('fresh locked version can bypass new resolution', async () => {
    const pkg = { name: 'fixture', version: '1.0.0', dependencies: { 'scouter-fixture-child': '1.1.0' } }
    const folder = project('locked', pkg)
    const artifact = manifests.get('scouter-fixture-child').versions['1.1.0'].dist
    const lock = { name: 'fixture', version: '1.0.0', lockfileVersion: 3, packages: {
      '': pkg, 'node_modules/scouter-fixture-child': {
        version: '1.1.0', resolved: artifact.tarball, integrity: artifact.integrity,
      },
    } }
    fs.writeFileSync(path.join(folder, 'package-lock.json'), JSON.stringify(lock))
    const count = requests.length
    const tree = await new Arborist(options(folder)).buildIdealTree()
    assert.equal(tree.children.get('scouter-fixture-child').version, '1.1.0')
    assert.equal(requests.length, count, 'Expected locked entry to avoid manifest selection')
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder, 'package-lock.json'))), lock)
  })
  await check('stricter cutoff retained through CLI without persistent config edits', () => {
    const folder = project('config', { name: 'fixture', version: '1.0.0' })
    const configFile = path.join(folder, '.npmrc')
    const config = `before=${strictCutoff}\n`
    fs.writeFileSync(configFile, config)
    const cli = path.join(npmRoot, 'bin/npm-cli.js')
    const query = flags => {
      const r = spawnSync(process.execPath, [cli, 'config', 'get', 'before', ...flags], {
        cwd: folder, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true' },
      })
      assert.equal(r.status, 0, r.stderr)
      return new Date(r.stdout.trim()).toISOString()
    }
    assert.equal(query([]), strictCutoff)
    // CLI can weaken project config; Scouter must explicitly preserve the earlier date.
    assert.equal(query([`--before=${cutoff}`]), cutoff)
    assert.equal(query([`--before=${strictCutoff}`]), strictCutoff)
    assert.throws(() => pick(manifests.get('scouter-fixture-root'), '1.0.0', { before: strictCutoff }))
    assert.equal(fs.readFileSync(configFile, 'utf8'), config)
  })
  await check('explicit runtime survives PATH differences in npm build subprocess', () => {
    const folder = project('runtime', { name: 'fixture', version: '1.0.0',
      scripts: { build: 'node probe.cjs' } })
    fs.writeFileSync(path.join(folder, 'probe.cjs'), 'console.log(JSON.stringify({exec:process.execPath,version:process.version}))')
    for (const inherited of ['/usr/local/bin:/usr/bin:/bin', '/usr/bin:/bin']) {
      const r = spawnSync(process.execPath, [path.join(npmRoot, 'bin/npm-cli.js'), 'run', 'build', '--silent'], {
        cwd: folder, encoding: 'utf8', env: { ...process.env,
          PATH: `${path.dirname(process.execPath)}:${inherited}`, npm_config_offline: 'true',
          npm_config_ignore_scripts: 'true' },
      })
      assert.equal(r.status, 0, r.stderr)
      const result = JSON.parse(r.stdout)
      assert.equal(fs.realpathSync(result.exec), fs.realpathSync(process.execPath))
      assert.equal(result.version, process.version)
    }
  })
  await check('authoritative snapshot survives hidden lock mutation', () => {
    const folder = project('baseline', { name: 'fixture', version: '1.0.0' })
    const file = path.join(folder, 'package-lock.json')
    const snapshot = path.join(temp, 'baseline-lock.json')
    const before = { packages: { '': { name: 'fixture' } } }
    fs.writeFileSync(file, JSON.stringify(before))
    fs.copyFileSync(file, snapshot)
    const added = { version: '1.0.0', resolved: 'https://registry.npmjs.org/fixture/-/fixture-1.0.0.tgz', integrity: 'fixture-hash' }
    const after = { packages: { ...before.packages, 'node_modules/fixture': added } }
    fs.writeFileSync(file, JSON.stringify(after))
    fs.mkdirSync(path.join(folder, 'node_modules'))
    fs.writeFileSync(path.join(folder, 'node_modules/.package-lock.json'), JSON.stringify(after))
    assert.deepEqual(JSON.parse(fs.readFileSync(snapshot)), before)
    assert.notDeepEqual(JSON.parse(fs.readFileSync(snapshot)), JSON.parse(fs.readFileSync(file)))
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder, 'node_modules/.package-lock.json'))), after)
  })
  await check('batched timestamp fallback: boundaries, failures, deduplication and compact output', async () => {
    // Offline policy model, not production helper or agent behavior evaluation.
    const coordinates = [
      { name: 'public-old', version: '1.0.0' },
      { name: 'public-old', version: '1.0.0', optional: true },
      { name: 'public-old', version: '2.0.0' },
      { name: 'public-fresh', version: '1.0.0', reusedLock: true },
      ...['missing', 'invalid', 'failed', 'optional'].map(n => ({ name: `public-${n}`, version: '1.0.0', optional: n === 'optional' })),
    ]
    const metadata = {
      'public-old': { time: { '1.0.0': '2026-10-01T00:00:00Z', '2.0.0': cutoff }, large: 'DO_NOT_PRINT'.repeat(10000) },
      'public-fresh': { time: { '1.0.0': '2026-10-17T00:00:00Z' } },
      'public-missing': { time: {} },
      'public-invalid': { time: { '1.0.0': 'invalid' } },
      'public-optional': { time: { '1.0.0': '2026-10-01T00:00:00Z' } },
    }
    const unique = [...new Map(coordinates.map(x => [`${x.name}@${x.version}`, x])).values()]
    const names = [...new Set(unique.map(x => x.name))]
    let next = 0, active = 0, maximum = 0
    const fetched = new Map(), calls = new Map()
    await Promise.all(Array.from({ length: Math.min(4, names.length) }, async () => {
      while (next < names.length) {
        const name = names[next++]
        calls.set(name, (calls.get(name) || 0) + 1)
        active++; maximum = Math.max(maximum, active)
        await new Promise(resolve => setTimeout(resolve, 1))
        fetched.set(name, metadata[name] || null)
        active--
      }
    }))
    const rows = unique.map(({name, version}) => {
      const m = fetched.get(name), t = m?.time?.[version]
      const reason = !m ? 'lookup failed' : !t ? 'missing timestamp' :
        !Number.isFinite(Date.parse(t)) ? 'invalid timestamp' : Date.parse(t) > Date.parse(cutoff) ? 'newer than cutoff' : ''
      return `${name} | ${version} | ${t || '-'} | ${reason ? 'FAIL: ' + reason : 'PASS'}`
    })
    assert.equal(calls.size, 6)
    assert([...calls.values()].every(n => n === 1))
    assert(maximum <= 4)
    assert.equal(rows.filter(x => x.endsWith('PASS')).length, 3)
    assert.equal(rows.filter(x => x.includes('FAIL:')).length, 4)
    assert(rows.some(x => x.includes('public-fresh') && x.includes('FAIL: newer')))
    assert(rows.some(x => x.includes('public-optional') && x.endsWith('PASS')))
    assert(rows.join('\n').length < 1000)
    assert(!rows.join('\n').includes('DO_NOT_PRINT'))
    // Local origin allowlist must run before exposing names to a fetcher.
    const allowed = x => { try { return new URL(x.resolved).origin === 'https://registry.npmjs.org' } catch { return false } }
    assert(!allowed({ resolved: 'https://private.example/private.tgz' }))
    assert(!allowed({ resolved: 'file:private.tgz' }))
    assert(allowed({ resolved: 'https://registry.npmjs.org/public-old/-/public-old-1.0.0.tgz' }))
  })
  console.log(`${passed} offline checks passed; no live acquisition or agent decisions tested.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
  .finally(() => fs.rmSync(temp, { recursive: true, force: true }))
