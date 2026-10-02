#!/usr/bin/env node
/**
 * setup-environment.mjs -- set up the Ubuntu environment in the app under test, through
 * Settings > Environments, the way a person does (WSL parity P9).
 *
 *   node suite/setup-environment.mjs --port 9339 --out <dir> [--distro Ubuntu]
 *
 * Answers the "Ubuntu found. Set it up?" prompt with Set it up when it shows (else opens
 * Settings > Environments itself), clicks Add <distro>, reads the consent card, clicks Run the
 * check, and waits for the probe. Records what the probe found (Claude and its version, the
 * sign-in, networking, node, git, Codex, the status line bridge) and FAILS when Claude is
 * missing in the distro or networking is not mirrored, since most of the suite needs both.
 * Already set up: records what is there and changes nothing. Not Windows: SKIP.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, record } from './lib/results.mjs'
import { click, exists, waitFor, sleep } from './lib/ui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
const ID = 'setup.environment'
const TITLE = 'Ubuntu set up in Settings > Environments, and what the check found'

const page = await connectToApp(portFromArgs())
try {
  const platform = await page.evaluate('window.electronPlatform || null')
  if (platform !== 'win32') {
    record(out, { id: ID, title: TITLE, status: 'SKIP', evidence: [`not Windows (${platform})`] })
    process.exit(0)
  }
  const envs = async () => (await callTestApi(page, 'environments')) ?? { environments: [], probeResults: {} }
  const distroName = arg('--distro')
  const pick = (list) => list.find((e) => e.kind === 'wsl' && (!distroName || e.distro === distroName))
  let current = await envs()
  let env = pick(current.environments)
  const evidence = []
  if (!env) {
    if (await exists(page, { css: '[data-testid="wsl-environment-prompt"]' })) {
      evidence.push('the "found. Set it up as an environment?" prompt showed; answered Set it up')
      await click(page, { within: '[data-testid="wsl-environment-prompt"]', text: 'Set it up', exact: true })
    } else {
      evidence.push('no set-up prompt showed (it shows once per data folder); opened Settings > Environments')
      await page.evaluate(`window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'environments' } }))`)
    }
    const addText = await waitFor(async () => page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => /^Add /.test(x.textContent.trim()) && (${JSON.stringify(distroName)} === null || x.textContent.trim() === 'Add ' + ${JSON.stringify(distroName)}))
      return b ? b.textContent.trim() : null
    })()`), { timeoutMs: 30_000, what: 'an "Add <distro>" button in Settings > Environments' })
    await click(page, { text: addText, exact: true })
    await click(page, { text: 'Run the check', exact: true })
    evidence.push(`${addText}, then Run the check`)
    env = await waitFor(async () => { current = await envs(); const e = pick(current.environments); return e && current.probeResults?.[e.id] ? e : null }, { timeoutMs: 240_000, intervalMs: 2000, what: 'the environment and its probe' })
  } else {
    evidence.push(`${env.id} was already set up`)
    if (!current.probeResults?.[env.id]) {
      // Check it again from Settings so this run has a probe answer.
      await page.evaluate(`window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'environments' } }))`)
      await sleep(1000)
      if (await exists(page, { text: 'Check again', exact: true })) await click(page, { text: 'Check again', exact: true })
      await waitFor(async () => { current = await envs(); return current.probeResults?.[env.id] }, { timeoutMs: 240_000, intervalMs: 2000, what: 'a probe answer' }).catch(() => null)
    }
  }
  const p = current.probeResults?.[env.id] ?? null
  if (p) {
    evidence.push(`probe: ok ${p.ok}${p.error ? ` (${p.error})` : ''}, Windows build ${p.windowsBuild}, WSL ${p.wslVersion?.version ?? p.wslVersion?.state}`)
    evidence.push(`claude ${p.claude?.path ?? 'missing'} ${p.claudeVersion ?? ''} via ${p.claudeVia ?? '-'}; signed in ${p.authLoggedIn} ${p.authEmail ? '(an account)' : ''}`)
    evidence.push(`networking: wslinfo ${p.networking?.wslinfo ?? '-'}, .wslconfig ${p.networking?.wslconfig ?? '-'}, mirrored ${p.networking?.mirrored}`)
    evidence.push(`node ${p.node?.path ?? 'missing'}, git ${p.git?.path ?? 'missing'}, codex ${p.codex?.path ?? 'missing'} ${p.codexVersion ?? ''}`)
    evidence.push(`home ${p.home}, mount root ${p.mountRoot}, status line bridge ${p.bridgeLinuxPath ?? 'unreachable'}, clock skew ${p.clockSkewMs} ms`)
  }
  await click(page, { css: 'button[aria-label="Chat"]' }).catch(() => {})
  const problems = []
  if (!p) problems.push('no probe answer')
  else {
    if (!p.claude?.path) problems.push('Claude is not installed in the distro')
    if (p.networking?.mirrored === false) problems.push('networking is not mirrored')
  }
  record(out, { id: ID, title: TITLE, status: problems.length ? 'FAIL' : 'PASS', evidence: [...(problems.length ? [problems.join('; ')] : [`${env.id} ready`]), ...evidence] })
  console.log(JSON.stringify({ environmentId: env.id, distro: env.distro, home: p?.home ?? null, codex: !!p?.codex?.path, signedIn: p?.authLoggedIn ?? null }))
  process.exit(problems.length ? 1 : 0)
} catch (err) {
  record(out, { id: ID, title: TITLE, status: 'FAIL', evidence: [String(err?.message ?? err)] })
  process.exit(1)
} finally {
  page.close()
}
