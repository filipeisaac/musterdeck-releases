#!/usr/bin/env node
/**
 * ram.mjs -- an Ubuntu session's RAM, read in its distro (WSL parity P8).
 *
 *   node suite/ram.mjs --port 9339 [--require-wsl] [--json]
 *
 * Through `window.__mdTest.ram()` (the memory panel's own `ram.snapshot`):
 *  - every live Ubuntu Claude or Codex session has a row, tagged with its environment, holding
 *    more than a few MB (the old meter read `wsl.exe`, a few MB);
 *  - on Windows, that row roughly matches `ps` in the distro: the RSS of every process whose
 *    environment carries the session's `CLAUDE_MULTI_SESSION_ID`, asked independently through
 *    `wsl.exe` (within 30% or 64 MB: the two reads are moments apart and Claude's heap moves);
 *  - a native session's row (where the platform's `ps` answers) carries no environment.
 * `--require-wsl` fails when no Ubuntu agent session is open. Exit 0 with one line on pass, 1
 * with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const MB = 1024 * 1024
const MIN_BYTES = 8 * MB

/** The session's resident bytes as the distro's own `ps` says, summed over every process carrying its id. */
function askDistro(distro, sid) {
  const script = [
    'COLUMNS=4096; export COLUMNS',
    `for p in $(grep -lazx 'CLAUDE_MULTI_SESSION_ID=${sid.replace(/[^A-Za-z0-9_-]/g, '')}' /proc/[0-9]*/environ 2>/dev/null | sed 's#/proc/\\([0-9]*\\)/environ#\\1#'); do`,
    '  ps -o rss= -p "$p" 2>/dev/null',
    'done | awk \'{ s += $1 } END { print "MD-RSS " s+0 }\'',
  ].join('\n')
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: script + '\n', encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  const m = /^MD-RSS (\d+)$/m.exec(r.stdout ?? '')
  return m ? Number(m[1]) * 1024 : null
}

try {
  const page = await connectToApp(port)
  const v = await callTestApi(page, 'ram')
  const terminals = await callTestApi(page, 'terminals')
  page.close()
  if (!v) {
    console.error('FAIL ram: ram() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  if (asJson) console.log(JSON.stringify(v, null, 2))
  const live = new Set(terminals ?? [])
  const rows = new Map(v.snapshot.sessions.map((r) => [r.sessionId, r]))
  const problems = []
  const ubuntu = v.sessions.filter((s) => s.host === 'wsl' && !s.shellOnly && live.has(s.id))
  if (requireWsl && ubuntu.length === 0) problems.push('no Ubuntu Claude or Codex session is open (open one and give it a moment)')

  const checked = []
  for (const s of ubuntu) {
    const row = rows.get(s.id)
    if (!row) { problems.push(`${s.id}: no RAM row (is ${s.environmentId} running?)`); continue }
    if (row.environmentId !== s.environmentId) problems.push(`${s.id}: the row says ${row.environmentId ?? 'this machine'}, the session runs in ${s.environmentId}`)
    if (row.bytes < MIN_BYTES) problems.push(`${s.id}: ${(row.bytes / MB).toFixed(1)} MB, too little for a ${s.provider} session (the wsl.exe tree?)`)
    let note = `${(row.bytes / MB).toFixed(0)} MB`
    if (process.platform === 'win32') {
      const said = askDistro(s.environmentId.replace(/^wsl:/, ''), s.id)
      if (said === null) problems.push(`${s.id}: the distro's ps did not answer`)
      else {
        const diff = Math.abs(said - row.bytes)
        if (diff > Math.max(64 * MB, 0.3 * said)) problems.push(`${s.id}: the meter says ${(row.bytes / MB).toFixed(0)} MB, ps in the distro ${(said / MB).toFixed(0)} MB`)
        note += ` (ps ${(said / MB).toFixed(0)} MB)`
      }
    }
    checked.push(`${s.id} ${note}`)
  }
  for (const s of v.sessions.filter((x) => x.host !== 'wsl')) {
    const row = rows.get(s.id)
    if (row?.environmentId) problems.push(`${s.id} (${s.host}): its row is tagged ${row.environmentId}`)
  }

  if (problems.length) {
    console.error(`FAIL ram: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log(checked.length
    ? `PASS ram: ${checked.join(', ')}; app ${(v.snapshot.appBytes / MB).toFixed(0)} MB`
    : `PASS ram: nothing Ubuntu to check; ${v.snapshot.sessions.length} native row(s), app ${(v.snapshot.appBytes / MB).toFixed(0)} MB`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
