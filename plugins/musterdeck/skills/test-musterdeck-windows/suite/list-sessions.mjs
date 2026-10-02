#!/usr/bin/env node
/**
 * list-sessions.mjs -- connect to a MusterDeck running in test mode and print its sessions.
 *
 * The seed of the WSL parity suite (P9 grows it). Usage:
 *
 *   MUSTERDECK_TEST_CDP=9339 <start MusterDeck>
 *   node suite/list-sessions.mjs --port 9339 [--json]
 *
 * Exit code 0 with the list, 1 when nothing answers.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const asJson = process.argv.includes('--json')

try {
  const page = await connectToApp(port)
  const sessions = await callTestApi(page, 'sessions')
  const active = await callTestApi(page, 'activeSession')
  page.close()
  if (asJson) {
    console.log(JSON.stringify({ port, active: active?.id ?? null, sessions }, null, 2))
  } else {
    console.log(`MusterDeck on 127.0.0.1:${port}: ${sessions.length} session(s)`)
    for (const s of sessions) {
      const mark = s.id === active?.id ? '*' : ' '
      const where = s.host === 'wsl' ? `wsl ${s.environmentId}` : s.host
      console.log(`${mark} ${s.id}  [${where}]  ${s.label ?? ''}  ${s.workingDirectory ?? ''}`)
    }
  }
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
