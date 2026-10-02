#!/usr/bin/env node
/**
 * codex.mjs -- does Codex run in Ubuntu, with its status and resume pointer read in the distro?
 * (WSL parity P7.) The spawn is OPT-IN.
 *
 *   node suite/codex.mjs --port 9339 [--require-wsl] [--run [--environment wsl:Ubuntu] [--timeout-s 120]] [--json]
 *
 * Without `--run` it only reads (`window.__mdTest.wslCodex()`): for every live Ubuntu Codex
 * session, the distro watch has claimed a rollout, that rollout's first line (read through
 * `wsl.exe`) is the `session_meta` of the same Codex session id, and the session record's resume
 * pointer names it. Each probed WSL environment says whether it has Codex. `--require-wsl` fails
 * when no WSL environment has been probed this run.
 *
 * With `--run` it starts ONE Ubuntu Codex PTY in the named WSL environment (default: the first
 * probed one with Codex) in its home, through the page's own `pty.spawn` (read-only sandbox, so
 * the session can change nothing), waits for `ready` and for the distro watch to claim its
 * rollout and send a status, reads that rollout through `wsl.exe`, and kills the PTY. A distro
 * without Codex is SKIPPED with a clear message (exit 0), not failed. Codex may write its
 * rollout only once it is past its own start, so give it `--timeout-s` (default 120).
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const doRun = argv.includes('--run')
const requireWsl = argv.includes('--require-wsl')
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null)
const timeoutS = Number(arg('--timeout-s') ?? 120)

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** A rollout's first line, read in the distro. */
function firstLine(distro, linuxPath) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: `head -n 1 ${q(linuxPath)}\n`, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  return String(r.stdout ?? '').trim()
}

function metaId(line) {
  try {
    const j = JSON.parse(line)
    return j.type === 'session_meta' ? String(j.payload?.id ?? '') : null
  } catch { return null }
}

/** Problems with one session's watch, record and rollout. */
function checkSession(s, records) {
  const problems = []
  const line = process.platform === 'win32' ? firstLine(s.distro, s.claimed.path) : null
  if (line !== null) {
    const id = metaId(line)
    if (id !== s.claimed.id) problems.push(`${s.sessionId}: ${s.claimed.path} begins with session ${id ?? '(no session_meta)'}, not ${s.claimed.id}`)
  }
  if (!s.last) problems.push(`${s.sessionId}: the watch claimed a rollout but sent no update`)
  const rec = records.find((r) => r.id === s.sessionId)
  if (rec && (rec.resumeUuid !== s.claimed.id || rec.resumeTranscriptPath !== s.claimed.path)) {
    problems.push(`${s.sessionId}: the record's resume pointer is ${rec.resumeUuid ?? 'none'} ${rec.resumeTranscriptPath ?? ''}, not the claimed rollout`)
  }
  return problems
}

try {
  const page = await connectToApp(port)
  const state = await callTestApi(page, 'wslCodex')
  if (!state) {
    page.close()
    console.error('FAIL codex: wslCodex() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  const probed = state.environments.filter((e) => e.probed)
  if (requireWsl && probed.length === 0) {
    page.close()
    console.error('FAIL codex: no WSL environment has been probed this run (start one Ubuntu session, or Check it in Settings, first)')
    process.exit(1)
  }

  if (!doRun) {
    page.close()
    if (asJson) console.log(JSON.stringify(state, null, 2))
    // Only sessions whose PTY lives have a watch; one that has not claimed yet is reported, not failed.
    const live = state.sessions
    const waiting = live.filter((s) => !s.claimed).map((s) => s.sessionId)
    const problems = live.filter((s) => s.claimed).flatMap((s) => checkSession(s, state.records ?? []))
    if (problems.length) {
      console.error(`FAIL codex: ${problems.join('; ')}`)
      process.exit(1)
    }
    const withCodex = probed.filter((e) => e.codex?.path).map((e) => `${e.id} (${e.codexVersion ?? 'version unknown'}, signed in: ${e.codexAuth ?? 'unknown'})`)
    console.log(`PASS codex: read only (pass --run to start one); ${live.length - waiting.length} live Ubuntu Codex session(s) checked${waiting.length ? `, ${waiting.length} not claimed yet (${waiting.join(', ')})` : ''}; Codex in ${withCodex.length ? withCodex.join(', ') : 'no probed environment'}`)
    process.exit(0)
  }

  const named = arg('--environment')
  const env = named ? state.environments.find((e) => e.id === named) : probed.find((e) => e.codex?.path)
  if (!env) {
    page.close()
    if (named || probed.length) {
      console.log(`SKIP codex: Codex is not installed in ${named ?? probed.map((e) => e.id).join(', ')} (install it there with npm i -g @openai/codex, then Check again in Settings)`)
      process.exit(0)
    }
    console.error('FAIL codex: no WSL environment has been probed this run; start one Ubuntu session first')
    process.exit(1)
  }
  if (!env.codex?.path) {
    page.close()
    console.log(`SKIP codex: Codex is not installed in ${env.id}${env.codex?.rejectedWindows ? ` (only Windows' ${env.codex.rejectedWindows})` : ''}`)
    process.exit(0)
  }

  const ptyId = `md-suite-codex-${Date.now()}`
  const options = { environmentId: env.id, provider: 'codex', codexOptions: { permissionsPreset: 'read-only' }, cols: 120, rows: 30, ...(env.home ? { cwd: env.home } : {}) }
  const spawned = await page.evaluate(`window.electronAPI.pty.spawn(${JSON.stringify(ptyId)}, ${JSON.stringify(options)}).then((r) => r, (e) => ({ kind: 'error', message: String(e && e.message || e) }))`)
  if (spawned?.kind !== 'ready') {
    page.close()
    console.error(`FAIL codex: the spawn in ${env.id} answered ${spawned?.kind ?? 'nothing'}${spawned?.message ? `: ${spawned.message}` : ''}`)
    process.exit(1)
  }
  const deadline = Date.now() + timeoutS * 1000
  let watch = null
  for (;;) {
    const now = await callTestApi(page, 'wslCodex')
    watch = (now?.sessions ?? []).find((s) => s.sessionId === ptyId) ?? null
    if (watch?.claimed && watch.last) break
    if (Date.now() > deadline) break
    await new Promise((r) => setTimeout(r, 2_000))
  }
  await page.evaluate(`window.electronAPI.pty.kill(${JSON.stringify(ptyId)})`)
  page.close()
  if (asJson) console.log(JSON.stringify({ environment: env, spawned, watch }, null, 2))

  const problems = []
  if (!watch) problems.push('no distro watch was started for the session')
  else if (!watch.claimed) problems.push(`no rollout claimed in ${env.distro} within ${timeoutS}s`)
  else {
    if (!watch.last) problems.push('the rollout was claimed but no status was sent')
    if (process.platform === 'win32') {
      const id = metaId(firstLine(env.distro, watch.claimed.path))
      if (id !== watch.claimed.id) problems.push(`the rollout read through wsl.exe begins with session ${id ?? '(none)'}, not ${watch.claimed.id}`)
    }
    if (!watch.claimed.path.startsWith('/')) problems.push(`the rollout path is not a Linux path: ${watch.claimed.path}`)
  }
  if (problems.length) {
    console.error(`FAIL codex: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log(`PASS codex: ran in ${env.id}, ready, claimed ${watch.claimed.path} (session ${watch.claimed.id})${watch.last?.model ? `, model ${watch.last.model}` : ''}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
