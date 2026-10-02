#!/usr/bin/env node
/**
 * type.mjs -- type a line into one terminal of the app under test, as a keyboard would, then
 * print what the terminal shows a moment later (WSL parity P9). For the human checks that
 * start with Claude typing something (a permission request for the notification, `ls` before
 * a Ctrl+click).
 *
 *   node suite/type.mjs --port 9339 --pty <session id | id-partner> --text "<line>" [--no-enter] [--wait-s 5]
 */
import { connectToApp, portFromArgs } from './lib/cdp.mjs'
import { click, exists, sleep, terminalText, typeInTerminal } from './lib/ui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const pty = arg('--pty')
const text = arg('--text')
if (!pty || text === null) { console.error('usage: type.mjs --port <n> --pty <id> --text "<line>" [--no-enter] [--wait-s 5]'); process.exit(2) }
const page = await connectToApp(portFromArgs())
try {
  const owner = pty.replace(/-partner$/, '')
  if (await exists(page, { css: 'button[aria-label="Chat"]' })) await click(page, { css: 'button[aria-label="Chat"]' })
  await click(page, { css: `[data-session-id="${owner}"] button` })
  if (pty.endsWith('-partner') && (await exists(page, { css: 'button[aria-label="Open Terminal"]' }))) await click(page, { css: 'button[aria-label="Open Terminal"]' })
  await sleep(800)
  await typeInTerminal(page, pty, text, { enter: !argv.includes('--no-enter') })
  await sleep(Number(arg('--wait-s', 5)) * 1000)
  console.log((await terminalText(page, pty)).split('\n').slice(-25).join('\n'))
} finally {
  page.close()
}
process.exit(0)
