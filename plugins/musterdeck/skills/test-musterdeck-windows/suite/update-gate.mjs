#!/usr/bin/env node
/**
 * update-gate.mjs -- an update must open on the person's sessions, never on first-run setup.
 *
 *   node suite/update-gate.mjs --prepare --data <the throwaway data folder> --out <dir>   (app quit)
 *   node suite/update-gate.mjs --check --port 9339 --out <dir>                             (app started)
 *
 * The 2026-10-07 Windows run updated 1.0.145 to 1.0.150 mid-run and the window opened on
 * "Where do you work?" in front of the restored sessions: the launch gate asked a question
 * nobody could answer "yes" to on Windows (fixed in 1.0.154). --prepare makes the throwaway
 * folder look set up by an OLDER build (app-meta.json's setupVersion set to 1.0.100, the
 * rest left as it is), so the next start takes the update path without installing anything.
 * --check then waits for the window: "Resume previous sessions?" (answered Resume, as a person
 * would) or the sessions themselves is a PASS; "Where do you work?" or Claude CLI Setup is a FAIL.
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, record } from './lib/results.mjs'
import { click, sleep, waitFor } from './lib/ui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
const ID = 'update.gate'
const TITLE = 'An update opens on the sessions, not on first-run setup'
const OLDER = '1.0.100'

if (argv.includes('--prepare')) {
  const data = arg('--data')
  const file = data && path.join(data, 'resources', 'CONFIG', 'app-meta.json')
  if (!file || !fs.existsSync(file)) {
    console.error(`FAIL update-gate: no app-meta.json under ${data ?? '(no --data)'}`)
    process.exit(1)
  }
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'))
  const was = meta.setupVersion ?? null
  meta.setupVersion = OLDER
  fs.writeFileSync(file, JSON.stringify(meta, null, 2))
  fs.writeFileSync(path.join(out ?? data, 'update-gate.json'), JSON.stringify({ was, now: OLDER }, null, 2))
  console.log(`PASS update-gate: app-meta.json setupVersion ${was} -> ${OLDER} (as if an older build set this folder up)`)
  process.exit(0)
}

const page = await connectToApp(portFromArgs())
const text = () => page.evaluate('document.body.innerText')
const evidence = []
try {
  const first = await waitFor(async () => {
    const t = await text()
    if (/Where do you work\?/.test(t)) return 'workspace'
    if (/Claude CLI Setup|Claude is ready/.test(t)) return 'cli-setup'
    if (/Resume previous sessions\?/.test(t)) return 'resume'
    if (((await callTestApi(page, 'sessions')) ?? []).length > 0) return 'sessions'
    return null
  }, { timeoutMs: 60_000, intervalMs: 1000, what: 'the first screen after the start' })
  evidence.push(`first screen: ${first}`)
  if (first === 'workspace' || first === 'cli-setup') {
    record(out, { id: ID, title: TITLE, status: 'FAIL', evidence: [...evidence, 'the update re-ran first-run setup (the 1.0.150 bug)'] })
    process.exit(1)
  }
  if (first === 'resume') {
    await click(page, { text: 'Resume', exact: true })
    evidence.push('answered "Resume previous sessions?" with Resume')
    await waitFor(async () => ((await callTestApi(page, 'sessions')) ?? []).length > 0, { timeoutMs: 30_000, what: 'the sessions to come back' })
  }
  await sleep(1500)
  const meta = await page.evaluate('window.electronAPI?.appMeta?.get ? window.electronAPI.appMeta.get() : null').catch(() => null)
  if (meta?.setupVersion) evidence.push(`setupVersion now ${meta.setupVersion}`)
  evidence.push(`${((await callTestApi(page, 'sessions')) ?? []).length} session(s) back`)
  record(out, { id: ID, title: TITLE, status: 'PASS', evidence })
} catch (err) {
  record(out, { id: ID, title: TITLE, status: 'FAIL', evidence: [...evidence, String(err?.message ?? err)] })
  process.exitCode = 1
} finally {
  page.close()
}
