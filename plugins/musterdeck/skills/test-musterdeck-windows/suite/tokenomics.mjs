#!/usr/bin/env node
/**
 * tokenomics.mjs -- does Tokenomics count an Ubuntu session's spend? (WSL parity P4.)
 *
 *   node suite/tokenomics.mjs --port 9339 [--session <id>] [--require-wsl] [--json]
 *
 * Reads `window.__mdTest.tokenomics(200)`: the page's KPIs, cost by config, and the newest
 * session rows (each with its `environmentId`). For every open Ubuntu Claude session (or just
 * `--session`) it finds the row for the session's conversation uuid and checks:
 *  - the row is there, tagged `wsl:<distro>` (read from the distro, not from Windows);
 *  - it cost something (> $0) and has messages;
 *  - when the session runs from a saved config, the row is attributed to that config and the
 *    config's line in "Cost by config" is above $0 (the WSL config cost).
 * Run it after the session has had at least one turn, and give the distro poll up to a few
 * seconds (it lists every 5 s while an Ubuntu session is open). `--require-wsl` fails when there
 * is no Ubuntu session to check. Exit 0 with one line on pass, 1 with the reasons.
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
  const tk = await callTestApi(page, 'tokenomics', 200)
  page.close()
  if (asJson) console.log(JSON.stringify(tk, null, 2))

  const problems = []
  if (!tk) {
    console.error('FAIL tokenomics: tokenomics() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  const targets = (sessions ?? []).filter((s) => only ? s.id === only : (s.host === 'wsl' && !s.shellOnly && (s.provider ?? 'claude') === 'claude'))
  if (targets.length === 0 && (requireWsl || only)) problems.push(only ? `no session ${only}` : 'no Ubuntu Claude session to check')

  const passed = []
  for (const s of targets) {
    const open = (tk.open ?? []).find((o) => o.id === s.id)
    const uuid = open?.uuid
    if (!uuid) { problems.push(`${s.label}: no conversation uuid yet (has it had a turn?)`); continue }
    const row = (tk.rows ?? []).find((r) => r.sessionId === uuid)
    if (!row) { problems.push(`${s.label}: no Tokenomics row for ${uuid} (distro not listed yet, or not indexed)`); continue }
    if (!String(row.environmentId ?? '').startsWith('wsl:')) problems.push(`${s.label}: row for ${uuid} is not tagged with a WSL environment (${row.environmentId ?? 'null'})`)
    if (!(row.costUsd > 0)) problems.push(`${s.label}: row for ${uuid} cost $0`)
    if (!(row.msgCount > 0)) problems.push(`${s.label}: row for ${uuid} has no messages`)
    const configId = open?.configId
    if (configId) {
      if (row.configId !== configId) problems.push(`${s.label}: spend attributed to ${row.configId ?? 'no config'}, not its config ${configId}`)
      const line = (tk.costByConfig ?? []).find((c) => c.configId === configId)
      if (!(line?.costUsd > 0)) problems.push(`${s.label}: its config ${configId} shows no cost in Cost by config`)
    }
    passed.push(`${s.label}=$${Number(row.costUsd).toFixed(4)} (${row.msgCount} msgs${configId ? `, config ${row.configLabel}` : ''})`)
  }

  if (problems.length) {
    console.error(`FAIL tokenomics: ${problems.join('; ')}`)
    process.exit(1)
  }
  const ubuntuTotal = (tk.rows ?? []).filter((r) => String(r.environmentId ?? '').startsWith('wsl:')).reduce((a, r) => a + (r.costUsd || 0), 0)
  console.log(`PASS tokenomics: ${passed.length ? passed.join(', ') : 'no Ubuntu session (nothing to check)'}; Ubuntu rows $${ubuntuTotal.toFixed(4)}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
