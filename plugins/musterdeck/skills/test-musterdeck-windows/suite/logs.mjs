#!/usr/bin/env node
/**
 * logs.mjs -- does Logs v2 hold an Ubuntu session's conversation? (WSL parity P3.)
 *
 *   node suite/logs.mjs --port 9339 [--session <id>] [--require-wsl] [--json]
 *
 * For every Ubuntu Claude session (or just `--session`), reads `window.__mdTest.sessionLog(id)`,
 * which is what the Logs pane, global Logs and the Crew card read: the transcript the binder
 * bound (a LINUX path under the distro's `~/.claude/projects`) and the rows the worker indexed
 * from it through the distro's share. Run it after the session has had at least one turn.
 *
 * Passes when each one has a bound transcript under `/` (never a `C:\` remap), at least one
 * message, and rows that read back. `--require-wsl` fails when there is no Ubuntu session to
 * check. Exit 0 with one line on pass, 1 with the reasons.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const only = argv.includes('--session') ? argv[argv.indexOf('--session') + 1] : null

try {
  const page = await connectToApp(port)
  const sessions = await callTestApi(page, 'sessions')
  const targets = (sessions ?? []).filter((s) => only ? s.id === only : (s.host === 'wsl' && !s.shellOnly && (s.provider ?? 'claude') === 'claude'))
  const results = []
  for (const s of targets) results.push({ id: s.id, label: s.label, log: await callTestApi(page, 'sessionLog', s.id, 5) })
  page.close()
  if (asJson) console.log(JSON.stringify(results, null, 2))

  const problems = []
  if (targets.length === 0) {
    if (requireWsl || only) problems.push(only ? `no session ${only}` : 'no Ubuntu Claude session to check')
  }
  for (const r of results) {
    const ingest = r.log?.ingest
    const paths = (ingest?.transcripts ?? []).map((t) => t.path)
    if (!r.log) { problems.push(`${r.label}: sessionLog() answered nothing (older build, or not in test mode?)`); continue }
    if (paths.length === 0) { problems.push(`${r.label}: no transcript bound yet (has it had a turn?)`); continue }
    const bad = paths.filter((p) => !p.startsWith('/'))
    if (bad.length) problems.push(`${r.label}: transcript bound to a non-Linux path ${bad.join(', ')}`)
    if (!(ingest.messageCount > 0)) problems.push(`${r.label}: bound (${paths[paths.length - 1]}) but nothing indexed`)
    else if (!(r.log.rows?.length > 0)) problems.push(`${r.label}: ${ingest.messageCount} messages counted but none read back`)
  }
  if (problems.length) {
    console.error(`FAIL logs: ${problems.join('; ')}`)
    process.exit(1)
  }
  const parts = results.map((r) => `${r.label}=${r.log.ingest.messageCount} msgs`)
  console.log(`PASS logs: ${parts.length ? parts.join(', ') : 'no Ubuntu session (nothing to check)'}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
