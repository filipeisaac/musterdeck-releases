#!/usr/bin/env node
/**
 * pages.mjs -- every page of the app opens and draws something, and the renderer threw
 * nothing on the way (from the macOS run of 1.0.106).
 *
 *   node suite/pages.mjs --port 9339 [--out <dir>] [--json]
 *
 * Clicks through the left rail as a person would: the Crew (a canvas is drawn), Logs,
 * Tokenomics, Memory and Insights (each shows text; Insights only opens, no run is started),
 * and Settings with every one of its tabs (each shows text). Then back to Chat. With `--out`
 * it keeps a screenshot of each page (`pages-<name>.png`).
 *
 * The renderer's console is read for the whole visit, including what it buffered since the
 * window loaded: an uncaught exception FAILS the check; console errors are listed as
 * evidence only, since some are known noise (a blocked blob fetch under the CSP).
 * Exit 0 with one line on pass, 1 with the reasons.
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectToApp, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs } from './lib/results.mjs'
import { click, exists, sleep, screenshot } from './lib/ui.mjs'

const asJson = process.argv.includes('--json')
const out = outDirFromArgs()

try {
  const page = await connectToApp(portFromArgs())
  const exceptions = [], errors = []
  page.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'))
    if (m.method === 'Runtime.exceptionThrown') exceptions.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text ?? '').split('\n')[0].slice(0, 200))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 200))
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(String(m.params.entry.text).split('\n')[0].slice(0, 200))
  })
  await page.send('Runtime.enable')
  await page.send('Log.enable')
  await sleep(500)

  const mainText = () => page.evaluate(`(document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').trim()`)
  const shot = async (name) => {
    if (!out) return null
    const f = path.join(out, `pages-${name}.png`)
    fs.writeFileSync(f, await screenshot(page))
    return path.basename(f)
  }
  /** A rail item: its own button, or the same name in the rail's Tools flyout. */
  async function open(name) {
    const direct = { css: `button[aria-label="${name}"]` }
    if (await exists(page, direct)) {
      await click(page, direct)
    } else {
      await click(page, { css: 'button[aria-label="Tools"]' })
      await sleep(300)
      await click(page, { css: '[role="menu"] [role="menuitem"]', text: name, exact: true })
    }
    await sleep(name === 'Crew' ? 7000 : 1500)
  }

  const results = []
  const problems = []
  for (const name of ['Crew', 'Logs', 'Tokenomics', 'Memory', 'Insights']) {
    try {
      await open(name)
      const text = await mainText()
      const canvas = name === 'Crew' ? await page.evaluate(`(() => { const c = document.querySelector('main canvas'); return c && c.width > 0 && c.height > 0 ? c.width + 'x' + c.height : null })()`) : null
      const file = await shot(name.toLowerCase())
      results.push({ page: name, chars: text.length, canvas, screenshot: file, text: text.slice(0, 120) })
      if (name === 'Crew' ? !canvas : !text) problems.push(`${name}: ${name === 'Crew' ? 'no canvas drawn' : 'the page is empty'}`)
    } catch (err) {
      problems.push(`${name}: ${err?.message ?? err}`)
    }
  }

  // Settings: every tab it has here (the list differs by platform and build) opens with text.
  try {
    await open('Configs')
    await sleep(500)
    const tabs = await page.evaluate(`Array.from(document.querySelectorAll('main button')).map((b) => b.textContent.replace(/\\s+/g, ' ').trim()).filter((t) => t && t.length < 24)`)
    const want = ['General', 'Appearance', 'Accounts', 'About'].filter((t) => !tabs.includes(t))
    if (want.length) problems.push(`Settings: no ${want.join(', ')} tab`)
    const opened = []
    for (const t of ['General', 'Appearance', 'Status line', 'Accounts', 'Environments', 'Shortcuts', 'Integrations', 'About'].filter((x) => tabs.includes(x))) {
      await click(page, { css: 'main button', text: t, exact: true })
      await sleep(400)
      const ok = (await mainText()).length > 0
      opened.push(`${t}:${ok ? 'ok' : 'EMPTY'}`)
      if (!ok) problems.push(`Settings > ${t} is empty`)
    }
    results.push({ page: 'Settings', tabs: opened, screenshot: await shot('settings') })
  } catch (err) {
    problems.push(`Settings: ${err?.message ?? err}`)
  }

  await open('Chat').catch(() => {})
  await sleep(500)
  page.close()

  const uniq = (xs) => [...new Set(xs)]
  if (asJson) console.log(JSON.stringify({ results, exceptions: uniq(exceptions), errors: uniq(errors) }, null, 2))
  for (const e of uniq(exceptions)) problems.push(`renderer exception: ${e}`)
  const evidence = [
    ...results.map((r) => r.page === 'Settings' ? `Settings tabs: ${r.tabs.join(', ')}` : `${r.page}: ${r.canvas ? `canvas ${r.canvas}, ` : ''}${r.chars} chars${r.screenshot ? `, ${r.screenshot}` : ''}`),
    `console: ${uniq(errors).length} distinct error(s), ${uniq(exceptions).length} exception(s)`,
    ...uniq(errors).slice(0, 4).map((e) => `console error: ${e}`),
  ]
  if (problems.length) {
    console.error(`FAIL pages: ${problems.join('; ')}`)
    for (const l of evidence) console.error(l)
    process.exit(1)
  }
  console.log(`PASS pages: ${results.map((r) => r.page).join(', ')} open and draw, no renderer exception`)
  for (const l of evidence) console.log(l)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
