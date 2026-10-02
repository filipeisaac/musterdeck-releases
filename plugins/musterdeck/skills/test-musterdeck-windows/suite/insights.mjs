#!/usr/bin/env node
/**
 * insights.mjs -- can Insights run in an Ubuntu environment? (WSL parity P4.) OPT-IN.
 *
 *   node suite/insights.mjs --port 9339 [--run] [--environment wsl:Ubuntu] [--timeout-min 15] [--json]
 *
 * Without `--run` it only reads (`window.__mdTest.insights()`): every run recorded for a WSL
 * environment that completed has its `environmentId`, and a failed one says why. It never starts
 * anything, because a run drives `/insights` and then `claude -p`, which takes minutes and spends
 * the account's tokens.
 *
 * With `--run` it starts ONE run in the named WSL environment (default: the first WSL one in
 * `environments()`) through the page's own API (`insights.run({ environmentId })`, what the
 * Insights page's button calls), waits for it to finish (`--timeout-min`, default 15), and
 * passes when it completed in that environment with a report (KPIs may be unavailable; that is
 * reported, not failed). Exit 0 with one line on pass, 1 with the reason.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const doRun = argv.includes('--run')
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null)
const timeoutMin = Number(arg('--timeout-min') ?? 15)

try {
  const page = await connectToApp(port)
  const before = await callTestApi(page, 'insights')
  if (!before) {
    console.error('FAIL insights: insights() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  if (!doRun) {
    page.close()
    if (asJson) console.log(JSON.stringify(before, null, 2))
    const wslRuns = before.runs.filter((r) => String(r.environmentId ?? '').startsWith('wsl:'))
    const bad = wslRuns.filter((r) => r.status === 'failed' && !r.error)
    if (bad.length) {
      console.error(`FAIL insights: ${bad.length} failed Ubuntu run(s) say nothing about why`)
      process.exit(1)
    }
    const done = wslRuns.filter((r) => r.status === 'complete').length
    console.log(`PASS insights: read only (pass --run to start one; slow and spends tokens); ${wslRuns.length} Ubuntu run(s) recorded, ${done} complete`)
    process.exit(0)
  }

  const envs = await callTestApi(page, 'environments')
  const environmentId = arg('--environment') ?? (envs?.environments ?? []).find((e) => e.kind === 'wsl')?.id
  if (!environmentId) {
    page.close()
    console.error('FAIL insights: no WSL environment to run in')
    process.exit(1)
  }
  const known = new Set(before.runs.map((r) => r.id))
  const started = await page.evaluate(`window.electronAPI.insights.run(${JSON.stringify({ environmentId })}).then((id) => ({ id }), (e) => ({ error: String(e && e.message || e) }))`)
  if (!started?.id) {
    page.close()
    console.error(`FAIL insights: the run did not start in ${environmentId}: ${started?.error ?? 'no answer'}`)
    process.exit(1)
  }
  const deadline = Date.now() + timeoutMin * 60_000
  let run = null
  for (;;) {
    const now = await callTestApi(page, 'insights')
    run = (now?.runs ?? []).find((r) => r.id === started.id) ?? null
    if (run && (run.status === 'complete' || run.status === 'failed')) break
    if (Date.now() > deadline) break
    await new Promise((r) => setTimeout(r, 5_000))
  }
  const report = run?.status === 'complete'
    ? await page.evaluate(`window.electronAPI.insights.getReport(${JSON.stringify(started.id)}).then((h) => (h ? h.length : 0))`)
    : 0
  page.close()
  if (asJson) console.log(JSON.stringify({ run, reportBytes: report, newRun: !known.has(started.id) }, null, 2))

  const problems = []
  if (!run) problems.push(`run ${started.id} never appeared in the catalogue`)
  else if (run.status !== 'complete') problems.push(run.status === 'failed' ? `failed: ${run.error ?? 'no reason'}` : `still ${run.status} after ${timeoutMin} min`)
  else {
    if (run.environmentId !== environmentId) problems.push(`ran in ${run.environmentId ?? 'Windows'}, not ${environmentId}`)
    if (!(report > 0)) problems.push('no report in the archive')
  }
  if (problems.length) {
    console.error(`FAIL insights: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log(`PASS insights: ran in ${environmentId}, report ${report} bytes${run.kpisUnavailable ? ', KPIs unavailable' : ', KPIs extracted'}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
