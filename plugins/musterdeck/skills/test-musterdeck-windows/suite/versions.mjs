#!/usr/bin/env node
/**
 * versions.mjs -- the Claude Code version per environment (WSL parity P7).
 *
 *   node suite/versions.mjs --port 9339 [--require-wsl] [--json]
 *
 * Through `window.__mdTest.versions()`:
 *  - every probed WSL environment's version is what its own claude says when asked through
 *    `wsl.exe` (`<probe's claude path> --version`; Windows only), and Sentinel (when it is on)
 *    has checked that environment at that version;
 *  - every Ubuntu Claude session's picker lists (the strip's models and efforts) are the
 *    registry's entries whose `minCcVersion` its version meets: its distro's version, or its
 *    pin; every other session's lists are the whole registry, as before;
 *  - the footer: with a WSL environment, one CLI dot per environment, the Primary first, each
 *    WSL dot's state agreeing with its probe; with none, the single "CLI" dot.
 * `--require-wsl` fails when no WSL environment has been probed this run. Exit 0 with one line
 * on pass, 1 with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')

const parse = (raw) => /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(String(raw ?? ''))?.[1] ?? null
const cmp = (a, b) => {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}
const meets = (min, v) => !parse(min) || !parse(v) || cmp(parse(v), parse(min)) >= 0
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** What the distro's claude says, asked through wsl.exe. */
function askDistro(distro, claudePath) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: `${q(claudePath)} --version 2>/dev/null | head -n 1\n`, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  return parse(r.stdout)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

try {
  const page = await connectToApp(port)
  const v = await callTestApi(page, 'versions')
  page.close()
  if (!v) {
    console.error('FAIL versions: versions() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  if (asJson) console.log(JSON.stringify(v, null, 2))
  const problems = []
  const envs = v.main.environments
  const probed = envs.filter((e) => e.probed)
  if (requireWsl && probed.length === 0) problems.push('no WSL environment has been probed this run (start one Ubuntu session first)')

  for (const e of probed) {
    if (process.platform === 'win32' && e.claudePath) {
      const said = askDistro(e.distro, e.claudePath)
      if (said !== parse(e.claudeVersion)) problems.push(`${e.id}: the probe recorded ${e.claudeVersion ?? 'no version'}, its claude says ${said ?? 'nothing'}`)
    }
    if (v.main.sentinel.enabled && e.claudeVersion) {
      const checked = v.main.sentinel.versions[e.id]?.version
      if (checked !== parse(e.claudeVersion)) problems.push(`${e.id}: Sentinel checked ${checked ?? 'nothing'}, not ${parse(e.claudeVersion)}`)
    }
  }

  const byId = Object.fromEntries(envs.map((e) => [e.id, e]))
  const allModels = v.registry.models.map((m) => m.value)
  const allEfforts = v.registry.efforts.map((e) => e.value)
  let ubuntuSessions = 0
  for (const s of v.sessions) {
    const ubuntuClaude = s.host === 'wsl' && s.provider === 'claude'
    if (ubuntuClaude) {
      ubuntuSessions++
      const env = byId[s.environmentId]
      if (env?.claudeVersion && !s.cliVersion) problems.push(`${s.id}: no CLI version, though ${s.environmentId} has ${env.claudeVersion}`)
    } else if (s.cliVersion) {
      problems.push(`${s.id} (${s.host}): a CLI version ${s.cliVersion}, where its lists must stay whole`)
    }
    const wantModels = v.registry.models.filter((m) => meets(m.minCcVersion, s.cliVersion)).map((m) => m.value)
    const wantEfforts = v.registry.efforts.filter((e) => meets(e.minCcVersion, s.cliVersion)).map((e) => e.value)
    if (!same(s.models, ubuntuClaude ? wantModels : allModels)) problems.push(`${s.id}: models ${s.models.join(',')}, want ${(ubuntuClaude ? wantModels : allModels).join(',')}`)
    if (!same(s.efforts, ubuntuClaude ? wantEfforts : allEfforts)) problems.push(`${s.id}: efforts ${s.efforts.join(',')}, want ${(ubuntuClaude ? wantEfforts : allEfforts).join(',')}`)
  }

  const bar = v.cliBar
  if (envs.length === 0) {
    if (bar.length !== 1 || bar[0].label !== 'CLI') problems.push(`the footer shows ${bar.length} CLI dot(s) with no WSL environment`)
  } else {
    if (bar.length !== envs.length + 1) problems.push(`the footer shows ${bar.length} CLI dot(s) for ${envs.length + 1} environments`)
    const primary = bar.filter((b) => b.primary)
    if (primary.length !== 1 || !bar[0].primary) problems.push('the Primary environment\'s dot is not first, or there is not exactly one')
    for (const b of bar.filter((x) => !x.native)) {
      const e = byId[b.id]
      if (!e?.probed) { if (b.state !== 'unchecked') problems.push(`${b.id}: the footer says ${b.state}, but nothing probed it`); continue }
      if (e.claudePath && b.state !== 'found') problems.push(`${b.id}: the footer says ${b.state}, the probe found ${e.claudePath}`)
      if (!e.claudePath && b.state === 'found') problems.push(`${b.id}: the footer says found, the probe found no claude`)
    }
  }

  if (problems.length) {
    console.error(`FAIL versions: ${problems.join('; ')}`)
    process.exit(1)
  }
  const ver = probed.map((e) => `${e.id} ${parse(e.claudeVersion) ?? 'no claude'}`).join(', ')
  console.log(probed.length || ubuntuSessions
    ? `PASS versions: ${ver || 'no environment probed'}; ${ubuntuSessions} Ubuntu session(s) with lists for their version; ${bar.length} CLI dot(s), ${bar[0].label} first`
    : `PASS versions: nothing to check (no WSL environment probed); ${v.sessions.length} session(s) keep the whole lists; ${bar.length} CLI dot(s)`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
