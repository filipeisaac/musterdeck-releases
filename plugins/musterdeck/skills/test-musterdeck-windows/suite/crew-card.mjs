#!/usr/bin/env node
/**
 * crew-card.mjs -- does the Crew's thread card show an Ubuntu session's conversation, and is
 * the session in the Crew's activity order? (WSL parity P3.)
 *
 *   node suite/crew-card.mjs --port 9339 [--session <id>] [--require-wsl] [--json]
 *
 * Reads `window.__mdTest.crewCard(id)`: the card's own reader (`fetchTranscript`, through
 * Logs v2) and the session's row in `logs2.sessionActivity`, which orders the map. Run it after
 * the session has had a turn. Exit 0 with one line on pass, 1 with the reasons.
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
  for (const s of targets) results.push({ id: s.id, label: s.label, card: await callTestApi(page, 'crewCard', s.id, 10) })
  page.close()
  if (asJson) console.log(JSON.stringify(results, null, 2))

  const problems = []
  if (targets.length === 0 && (requireWsl || only)) problems.push(only ? `no session ${only}` : 'no Ubuntu Claude session to check')
  for (const r of results) {
    const c = r.card
    if (!c) { problems.push(`${r.label}: crewCard() answered nothing (older build, or not in test mode?)`); continue }
    if (!c.ok) { problems.push(`${r.label}: the card says "${c.error}"`); continue }
    if (!(c.messages?.length > 0)) problems.push(`${r.label}: the card has no messages`)
    if (!c.activity) problems.push(`${r.label}: not in the Crew's activity order`)
  }
  if (problems.length) {
    console.error(`FAIL crew-card: ${problems.join('; ')}`)
    process.exit(1)
  }
  const parts = results.map((r) => `${r.label}=${r.card.messages.length} msgs, rank ${r.card.activity.rank}`)
  console.log(`PASS crew-card: ${parts.length ? parts.join(', ') : 'no Ubuntu session (nothing to check)'}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
