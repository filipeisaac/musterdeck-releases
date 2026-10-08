#!/usr/bin/env node
/**
 * screenshot.mjs -- save what the app's window shows, as evidence (WSL parity P9). Chromium's
 * own capture of the page, so it works with the window behind others (not minimised).
 *
 *   node suite/screenshot.mjs --port 9339 --out <dir> --name <file stem> [--view Chat|Crew|Tokenomics|...] [--session <id>]
 *
 * `--view` clicks that item of the left rail first; `--session` makes that session's tab the
 * active one (Chat view). Writes `<out>/<name>.png` and prints its path.
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectToApp, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs } from './lib/results.mjs'
import { click, exists, screenshot, sleep } from './lib/ui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
const name = arg('--name')
if (!out || !name || !/^[\w.-]+$/.test(name)) { console.error('usage: screenshot.mjs --port <n> --out <dir> --name <stem> [--view <rail item>] [--session <id>]'); process.exit(2) }
const page = await connectToApp(portFromArgs())
try {
  const view = arg('--view')
  if (view) {
    // A rail item, or the same name in the rail's Tools flyout (Tokenomics, Logs, Memory and
    // Insights live there): pages.mjs's rule. A rail-only click failed on Tokenomics (2026-10-06).
    const direct = { css: `button[aria-label="${view}"]` }
    if (await exists(page, direct)) await click(page, direct)
    else {
      await click(page, { css: 'button[aria-label="Tools"]' })
      await sleep(300)
      await click(page, { css: '[role="menu"] [role="menuitem"]', text: view, exact: true })
    }
    await sleep(view === 'Crew' ? 6000 : 1200)
  }
  const session = arg('--session')
  if (session) {
    if (await exists(page, { css: 'button[aria-label="Chat"]' })) await click(page, { css: 'button[aria-label="Chat"]' })
    await click(page, { css: `[data-session-id="${session}"] button` })
    await sleep(1200)
  }
  const file = path.join(out, `${name}.png`)
  fs.writeFileSync(file, await screenshot(page))
  console.log(file)
} finally {
  page.close()
}
process.exit(0)
