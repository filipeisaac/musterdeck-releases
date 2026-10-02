#!/usr/bin/env node
/**
 * quit-app.mjs -- quit the app under test the way a person does, so its sessions are saved
 * for the next launch (WSL parity P9): the window's close (the title bar's own call), then
 * Save Sessions in the close dialog, then wait until the debugging port stops answering.
 *
 *   node suite/quit-app.mjs --port 9339 [--out <dir>] [--timeout-s 60]
 *
 * Exit 0 once the app is gone; 1 when it is still running after the timeout (then end it by
 * hand and say so in the findings: its sessions may not have been saved).
 */
import { connectToApp, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, record } from './lib/results.mjs'
import { click, exists, waitFor } from './lib/ui.mjs'

const argv = process.argv.slice(2)
const port = portFromArgs()
const out = outDirFromArgs()
const timeoutMs = Number(argv.includes('--timeout-s') ? argv[argv.indexOf('--timeout-s') + 1] : 60) * 1000
const alive = async () => {
  try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch { return false }
}

const evidence = []
const page = await connectToApp(port, { timeoutMs: 10_000 }).catch(() => null)
if (!page) evidence.push('no window to close')
else {
  try {
    await page.evaluate('window.electronAPI.window.close()')
    const dialog = await waitFor(async () => (await exists(page, { text: 'Save Sessions', exact: true })) || !(await alive()) ? true : null, { timeoutMs: 15_000, what: 'the close dialog' }).catch(() => null)
    if (dialog && (await alive()) && (await exists(page, { text: 'Save Sessions', exact: true }))) {
      evidence.push('the close dialog asked; chose Save Sessions')
      await click(page, { text: 'Save Sessions', exact: true })
    } else {
      evidence.push('no close dialog (no live sessions)')
    }
  } catch (err) {
    // The page going away mid-call is the app quitting.
    evidence.push(`page closed: ${String(err?.message ?? err).slice(0, 120)}`)
  }
  page.close()
}
// macOS keeps an app running with no window (Windows and Linux quit with the last one), so
// once the window is gone ask the browser itself to close, which quits the app there.
if (!(await waitFor(async () => !(await alive()), { timeoutMs: 8_000, intervalMs: 500 }).then(() => true, () => false))) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    if (!targets.some((t) => t.type === 'page')) {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
      const ws = new WebSocket(webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
      evidence.push('the window closed and the app stayed (macOS): asked the browser to close')
    }
  } catch { /* gone in between */ }
}
const gone = await waitFor(async () => !(await alive()), { timeoutMs, intervalMs: 500, what: 'the app to exit' }).then(() => true, () => false)
evidence.push(gone ? 'the app exited' : `still answering on ${port} after ${timeoutMs / 1000}s`)
record(out, { id: 'app.quit', title: 'Quit the app with Save Sessions', status: gone ? 'PASS' : 'FAIL', evidence })
process.exit(gone ? 0 : 1)
