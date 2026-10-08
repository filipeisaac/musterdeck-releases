#!/usr/bin/env node
/**
 * onboarding.mjs -- a brand-new install's first run, through setup's first page ("Set up"),
 * the way a new user goes through it (plugin 1.0.14).
 *
 *   node suite/onboarding.mjs --port 9341 --out <dir> --workspace <folder>
 *        [--install] [--update] [--switch-networking] [--person-wait-min 10]
 *
 * The app must be in test mode against a throwaway folder whose `resources/CONFIG/app-meta.json`
 * is `{}` (the skill's R3b makes it): test mode then leaves the folder unseeded, so every
 * first-run screen shows, exactly as on a new install, while the person's real data is never
 * opened. Screens, in order, each recorded as `onboarding.<step>` with its evidence:
 *
 *   workspace     "Where do you work?": the given folder (a throwaway one, so the trust Claude
 *                 records lands there and not on the person's home)
 *   cli-setup     "Claude CLI Setup": Claude in a terminal; its folder trust question answered
 *                 by moving to its Yes option (never a bare Enter), then /exit
 *   welcome       the look, then Let's go
 *   find-claude   this computer's rows: installed, the version (Run it for me), signed in
 *   ubuntu        Check <distro>, Run the check, every row as the probe found it
 *   ubuntu.<row>  each row that is not fine, through ITS fix: an install runs (with --install),
 *                 a sign-in waits for the person, the networking Switch only with
 *                 --switch-networking (it restarts WSL)
 *   compatibility the verdict for this computer and each Ubuntu; with --update, Claude Code's own
 *                 updater on the page, then Check again
 *   set-up-done   Next (or Continue anyway) lands on the Account page
 *
 * Nothing here signs anybody in. When a screen needs the person (a sign-in, a question only they
 * can answer) it prints `WAITING FOR THE PERSON: <what to do>` and waits up to --person-wait-min
 * minutes for the screen to move on, then records what it saw. Run it in the background and
 * relay those lines.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { connectToApp, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, step, record, failWith } from './lib/results.mjs'
import { click, exists, setValue, waitFor, sleep, screenshot } from './lib/ui.mjs'
import { TRUST, CLAUDE_READY, offerOnScreen, selectPrompt, describeOptions } from './lib/claude-tui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const flag = (name) => argv.includes(name)
const out = outDirFromArgs()
const workspace = arg('--workspace')
const personWaitMs = Number(arg('--person-wait-min', '10')) * 60_000
const P = 'onboarding'

const page = await connectToApp(portFromArgs())

// ── the page, read and driven as a person would ─────────────────────────────────────────────
const text = () => page.evaluate('document.body.innerText')
const testText = (id) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(`[data-testid="${id}"]`)}); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null })()`)
const has = (id) => exists(page, { css: `[data-testid="${id}"]` })
const press = (label) => click(page, { text: label, exact: true })
let shotN = 0
async function shot(name) {
  if (!out) return null
  const file = `onboarding-${String(++shotN).padStart(2, '0')}-${name}.png`
  fs.writeFileSync(path.join(out, file), await screenshot(page))
  return file
}
async function waitForPerson(what, done) {
  console.log(`WAITING FOR THE PERSON: ${what}`)
  return waitFor(done, { timeoutMs: personWaitMs, intervalMs: 2000, what: `the person to ${what}` })
}

// A terminal on these screens is not a session terminal: read and type into its xterm directly.
const xtermIn = (scope) => `${scope ? `[data-testid="${scope}"] ` : ''}.xterm`
const xtermText = (scope) => page.evaluate(`(() => { const t = [...document.querySelectorAll(${JSON.stringify(xtermIn(scope))})].find((e) => e.offsetParent || e.getClientRects().length); return t ? t.innerText : '' })()`)
async function xtermFocus(scope) {
  const ok = await page.evaluate(`(() => { const t = [...document.querySelectorAll(${JSON.stringify(`${xtermIn(scope)} textarea`)})].find((e) => e.closest('.xterm').getClientRects().length); if (!t) return false; t.focus(); return document.activeElement === t })()`)
  if (!ok) throw new Error(`no terminal input${scope ? ` in ${scope}` : ''}`)
}
async function xtermType(scope, line) {
  await xtermFocus(scope)
  if (line) await page.send('Input.insertText', { text: line })
  await sleep(150)
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
}
async function xtermKey(scope, key) {
  const vk = { ArrowUp: 38, ArrowDown: 40 }[key]
  await xtermFocus(scope)
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
/** Claude's folder trust question: move onto its Yes option, check, then Enter. Never a blind Enter. */
async function answerTrust(scope) {
  return answerOption(scope, 'the trust question', (sp) => sp.yes)
}
/** Move the cursor of the select prompt on screen onto the option `pick` names, check, Enter. */
async function answerOption(scope, what, pick) {
  for (let i = 0; i < 8; i++) {
    const sp = selectPrompt(await xtermText(scope), 60)
    const want = sp && pick(sp)
    if (!want || !sp.selected) throw new Error(`cannot read the options of ${what}${sp ? ` (${describeOptions(sp)})` : ''}`)
    if (sp.selected.n === want.n) { await xtermType(scope, ''); return `"${want.text}"` }
    await xtermKey(scope, want.n > sp.selected.n ? 'ArrowDown' : 'ArrowUp')
    await sleep(400)
  }
  throw new Error(`the cursor would not move onto the option of ${what}`)
}
/** Claude's own offer on screen (`OFFERS`), declined: accepting it would change the person's settings. */
async function declineOffer(scope, text) {
  const offer = offerOnScreen(text)
  if (!offer) return null
  const chose = await answerOption(scope, `the offer of ${offer.name}`, (sp) => sp.options.find((o) => offer.decline.test(o.text)))
  return `declined Claude's offer of ${offer.name} with ${chose}`
}

/**
 * What this computer's Claude itself says about its sign-in (`claude auth status`, metadata
 * only), with the identity a parent Claude session stamps into the environment removed, as
 * MusterDeck removes it for everything it starts. Null when it cannot be asked.
 */
function claudeAuthStatus(claudePath) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (/^(CLAUDE_CODE_|CLAUDECODE$|ANTHROPIC_API_KEY$|ANTHROPIC_BASE_URL$)/.test(k)) delete env[k]
  try {
    const r = spawnSync(claudePath, ['auth', 'status'], { env, encoding: 'utf8', timeout: 30_000, windowsHide: true, shell: /\.(cmd|bat)$/i.test(claudePath) })
    const j = JSON.parse(String(r.stdout ?? '').trim())
    return { loggedIn: j.loggedIn === true, email: j.email ?? null, orgName: j.orgName ?? null }
  } catch {
    return null
  }
}

/** One check row, as `✓ <what it says>` or `! <what it says>`. */
const rowLine = (t) => (t ? `${/^✓/.test(t) ? 'ok' : 'NOT OK'}: ${t.replace(/^[✓!?]\s*/, '').slice(0, 160)}` : null)

try {
  // ── 1. Where do you work? ──────────────────────────────────────────────────────────────────
  await step(out, `${P}.workspace`, '"Where do you work?" takes a folder', async () => {
    await waitFor(async () => /Where do you work\?/.test(await text()), { timeoutMs: 60_000, what: '"Where do you work?" (is this folder unseeded, app-meta.json = {}?)' })
    const evidence = [`screen: ${await shot('workspace')}`]
    if (workspace) {
      await setValue(page, { near: 'Workspace folder' }, workspace)
      await sleep(300)
      await press('Continue')
      evidence.push(`set ${workspace}, then Continue`)
    } else {
      await press('Continue without one')
      evidence.push('no --workspace given: Continue without one (Claude will ask to trust the home folder)')
    }
    await waitFor(async () => !/Where do you work\?/.test(await text()), { timeoutMs: 30_000, what: 'the next screen' })
    return { evidence }
  })

  // ── 2. Claude CLI Setup ────────────────────────────────────────────────────────────────────
  await step(out, `${P}.cli-setup`, '"Claude CLI Setup": trust the folder, then /exit', async () => {
    const shown = await waitFor(async () => {
      const t = await text()
      return /Claude CLI Setup/.test(t) ? 'cli' : /Claude is ready/.test(t) ? 'ready' : /Let's go|Let.s find Claude/.test(t) ? 'skipped' : null
    }, { timeoutMs: 60_000, what: 'Claude CLI Setup or the onboarding' })
    if (shown === 'skipped') return { status: 'INFO', evidence: ['not shown: Claude was already set up for this folder'] }
    if (shown === 'ready') {
      // The folder was trusted before (a second run in the same folder): nothing to answer.
      const evidence = ['"Claude is ready": the folder is already trusted and Claude is signed in', `screen: ${await shot('cli-ready')}`]
      await press('Continue')
      await waitFor(async () => !/Claude is ready/.test(await text()), { timeoutMs: 30_000, what: 'the onboarding' })
      return { status: 'INFO', evidence }
    }
    const evidence = []
    let trusted = false
    await waitFor(async () => {
      const t = await xtermText()
      const tail = t.split(/\r?\n/).slice(-40).join('\n')
      const declined = await declineOffer(null, t)
      if (declined) { evidence.push(declined); return null }
      if (!trusted && TRUST.test(tail) && !CLAUDE_READY.test(tail)) { evidence.push(`trust: ${await answerTrust()}`); trusted = true; return null }
      return CLAUDE_READY.test(t)
    }, { timeoutMs: 120_000, intervalMs: 1000, what: "Claude's prompt in the setup terminal" }).catch(async (e) => {
      // Not ready: most likely a sign-in, which is the person's.
      evidence.push(`terminal: ${(await xtermText()).split(/\r?\n/).filter(Boolean).slice(-6).join(' / ')}`)
      await waitForPerson('finish what Claude asks in the "Claude CLI Setup" terminal (sign in if it asks), then type /exit', async () => !/Claude CLI Setup/.test(await text()) || CLAUDE_READY.test(await xtermText()))
        .catch(() => { throw failWith(String(e.message), evidence) })
    })
    evidence.push(`screen: ${await shot('cli-setup')}`)
    if (/Claude CLI Setup/.test(await text())) {
      await xtermType(null, '/exit')
      await waitFor(async () => !(await exists(page, { css: '[data-testid="cli-setup-hint"]' })), { timeoutMs: 30_000, what: 'Claude to exit' })
      if (/Claude CLI Setup/.test(await text())) await press('Continue')
    }
    await waitFor(async () => !/Claude CLI Setup/.test(await text()), { timeoutMs: 30_000, what: 'the onboarding' })
    return { evidence: [trusted ? 'answered the trust question with its Yes option' : 'no trust question', ...evidence] }
  })

  // ── 3. Welcome ─────────────────────────────────────────────────────────────────────────────
  await step(out, `${P}.welcome`, 'Welcome: a look, then Let\'s go', async () => {
    await waitFor(async () => /Let's go/.test(await text()), { timeoutMs: 30_000, what: 'the Welcome page' })
    const evidence = [`screen: ${await shot('welcome')}`]
    await press('Let\'s go →')
    await waitFor(async () => /Let's find Claude Code/.test(await text()), { timeoutMs: 30_000, what: 'Find Claude' })
    return { evidence }
  })

  // ── 4. Find Claude: this computer ──────────────────────────────────────────────────────────
  await step(out, `${P}.find-claude`, 'Find Claude: this computer\'s Claude, its version, the sign-in', async () => {
    const evidence = []
    if (await has('onboarding-fix-native-claude')) {
      if (!flag('--install')) return { status: 'FAIL', evidence: ['Claude Code is not installed on this computer, and --install was not given'] }
      await click(page, { css: '[data-testid="onboarding-fix-native-claude-run"]' })
      evidence.push('Claude Code missing: ran Install it for me')
      await waitForPerson('let the Claude Code installer finish in the terminal on the Find Claude page, then press Check again', async () => !(await has('onboarding-fix-native-claude')))
    }
    if (await exists(page, { text: 'Run it for me', exact: true })) {
      await press('Run it for me')
      await waitFor(async () => /Read just now with claude --version|Couldn't read the version/.test(await text()), { timeoutMs: 60_000, what: 'the version' })
    }
    if (await has('onboarding-fix-native-sign-in')) {
      evidence.push('not signed in: Sign in now')
      await click(page, { css: '[data-testid="onboarding-fix-native-sign-in-run"]' })
      await signInVia('onboarding-fix-native-sign-in-terminal', 'on the Find Claude page (since 1.0.154 it runs claude auth login and closes by itself)', async () => !(await has('onboarding-fix-native-sign-in')))
    }
    // Each row is its title on a line of its own, then its detail (the page's subtitle also
    // says "installed and you're signed in", so a row is matched as a whole line).
    const t = await text()
    const row = (title) => { const m = new RegExp(`(?:^|\\n)(${title})\\n([^\\n]*)`).exec(t); return m ? `${m[1]}: ${m[2]}` : null }
    const installed = row('Claude Code is installed')
    const version = row('Claude Code \\d+\\.\\d+\\.\\d+[^\\n]*')
    const signedIn = row("You're signed in")
    evidence.push(installed ?? 'no "Claude Code is installed" row', version ?? 'no version row', signedIn ?? 'no "signed in" row')
    evidence.push(`screen: ${await shot('find-claude')}`)
    // "Signed in" must be Claude's own answer, not a config file's (2026-10-06: the page said
    // signed in from .claude.json while `claude auth status` said loggedIn false, and every
    // Windows Claude session then said "Not logged in").
    const claudePath = /Found at (.+?)\.?$/.exec(installed ?? '')?.[1]?.trim()
    const truth = claudePath ? claudeAuthStatus(claudePath) : null
    if (truth) evidence.push(`claude auth status: loggedIn=${truth.loggedIn}${truth.email ? ` as ${truth.email}${truth.orgName ? ` (${truth.orgName})` : ''}` : ''}`)
    const lied = !!signedIn && truth?.loggedIn === false
    if (lied) evidence.push('the page says signed in, but Claude says nobody is signed in')
    const ok = !!installed && !!version && /Read just now with claude --version/.test(version) && !!signedIn && !lied
    return { status: ok ? 'PASS' : 'FAIL', evidence }
  })

  // ── 5. Find Claude: Ubuntu ─────────────────────────────────────────────────────────────────
  const ROW_IDS = ['claude', 'signed-in', 'networking', 'node', 'codex-signed-in', 'status-line', 'probe']
  const readRows = async () => {
    const rows = []
    for (const id of ROW_IDS) {
      const t = await testText(`onboarding-check-${id}`)
      if (t) rows.push({ id, ok: /^✓/.test(t), text: t })
    }
    return rows
  }
  let ubuntu = false
  await step(out, `${P}.ubuntu`, 'Find Claude: Check Ubuntu, Run the check, every row', async () => {
    if (!(await has('onboarding-wsl-panel'))) return { status: 'SKIP', evidence: ['no Ubuntu panel on this machine'] }
    ubuntu = true
    if (await has('onboarding-wsl-look')) {
      await click(page, { css: '[data-testid="onboarding-wsl-look"]' })
      await waitFor(async () => has('wsl-probe-confirm'), { timeoutMs: 15_000, what: 'the list of commands the check runs' })
      await press('Run the check')
    }
    await waitFor(async () => has('onboarding-check-claude'), { timeoutMs: 240_000, intervalMs: 2000, what: 'the check rows' })
    await sleep(1500)
    const rows = await readRows()
    return { status: rows.every((r) => r.ok) ? 'PASS' : 'INFO', evidence: [...rows.map((r) => `${r.id} ${rowLine(r.text)}`), `screen: ${await shot('ubuntu')}`] }
  })

  /**
   * A sign-in in the terminal that just opened inside `scope`: Claude's own first questions (the
   * text style, the login method) take their defaults, the link it prints is printed as
   * `SIGN-IN LINK: <url>` for whoever relays it, and the rest is the person's. The code the
   * browser shows is never typed here: pasting it IS signing in, and that is theirs.
   */
  async function signInVia(scope, where, done) {
    let link = null
    await waitFor(async () => {
      if (await done()) return true
      const t = await xtermText(scope)
      const tail = t.split(/\r?\n/).slice(-30).join('\n')
      if (/Choose the text style/.test(tail)) { await xtermType(scope, ''); await sleep(1500); return null }
      if (/Select login method/.test(tail) && /❯\s*1\.\s*Claude account/.test(tail)) { await xtermType(scope, ''); await sleep(1500); return null }
      const m = /https:\/\/\S*oauth\S*/.exec(t.replace(/\r?\n/g, ''))
      if (m) { link = m[0]; return true }
      return null
    }, { timeoutMs: 120_000, intervalMs: 1500, what: 'the sign-in link' })
    if (link && !(await done())) {
      console.log(`SIGN-IN LINK: ${link}`)
      await waitForPerson(`open the SIGN-IN LINK above, sign in, then paste the code the browser shows into the sign-in terminal ${where} (Ctrl+V or a right-click) and press Enter`, done)
    }
  }

  // ── 6. Each Ubuntu row that is not fine, through its own fix ───────────────────────────────
  // Scanned again after every fix: a fix can reveal a row (Claude installed, then its sign-in
  // row appears), which a single scan missed on the first real run (2026-10-06).
  const tried = new Set()
  for (let pass = 0; ubuntu && pass < ROW_IDS.length; pass++) {
    const r = (await readRows()).find((x) => !x.ok && !tried.has(x.id))
    if (!r) break
    tried.add(r.id)
    await step(out, `${P}.ubuntu.${r.id}`, `Ubuntu: fix "${r.id}" on the page`, async () => {
      const before = rowLine(r.text)
      const fixed = async () => /^✓/.test((await testText(`onboarding-check-${r.id}`)) ?? '')
      if (r.id === 'signed-in') {
        await click(page, { css: '[data-testid="onboarding-wsl-sign-in-open"]' })
        await signInVia('onboarding-wsl-panel', 'on the Find Claude page', fixed)
      } else if (r.id === 'networking') {
        if (!flag('--switch-networking')) return { status: 'SKIP', evidence: [before, 'Switch restarts WSL: not run without --switch-networking (the person\'s yes)'] }
        if (process.platform !== 'win32') return { status: 'SKIP', evidence: [before, 'not from inside WSL: restarting WSL would end this run'] }
        // The flag IS the person's yes: confirm the card, then its restart question.
        await click(page, { within: '[data-testid="onboarding-check-networking"]', text: 'Switch', startsWith: true })
        await click(page, { text: 'Switch to mirrored', exact: true }, { timeoutMs: 15_000 })
        await click(page, { text: 'Restart WSL now', exact: true }, { timeoutMs: 30_000 })
        await waitFor(fixed, { timeoutMs: 180_000, intervalMs: 3000, what: 'mirrored networking after the restart' })
          .catch(() => waitForPerson('answer the Switch questions on the Find Claude page (it restarts WSL), then Check again', fixed))
      } else {
        const run = `onboarding-fix-wsl-${r.id}-run`
        if (!(await has(run))) return { status: 'FAIL', evidence: [before, 'no fix button on this row'] }
        const cmd = await testText(`onboarding-fix-wsl-${r.id}`)
        if (!flag('--install')) return { status: 'SKIP', evidence: [before, `fix offered, not run without --install: ${cmd}`] }
        await click(page, { css: `[data-testid="${run}"]` })
        await waitFor(fixed, { timeoutMs: 10 * 60_000, intervalMs: 3000, what: `${r.id} to turn ok after its fix` })
          .catch(() => waitForPerson(`look at the ${r.id} terminal on the Find Claude page and press Check again when it is done`, fixed))
      }
      return { evidence: [`before: ${before}`, `after: ${rowLine(await testText(`onboarding-check-${r.id}`))}`, `screen: ${await shot(`ubuntu-${r.id}`)}`] }
    })
  }

  // Where sessions run: recorded as the page offers it, left to its defaults.
  if (await has('onboarding-environment-choice')) {
    record(out, { id: `${P}.where-sessions-run`, title: 'Find Claude asks where sessions run', status: 'INFO', evidence: [String(await testText('onboarding-environment-choice')).slice(0, 300)] })
  }

  // ── 7. Compatibility ───────────────────────────────────────────────────────────────────────
  await step(out, `${P}.compatibility`, 'Compatibility: the verdict, and Update Claude Code on the page', async () => {
    await press('Next →')
    await waitFor(async () => /Quick compatibility check/.test(await text()), { timeoutMs: 30_000, what: 'the compatibility check' })
    const evidence = [`this computer: ${((await text()).match(/You're on Claude Code [^\n]*/) ?? ['?'])[0]}`]
    for (const w of await page.evaluate(`[...document.querySelectorAll('[data-testid="compat-wsl"]')].map((e) => e.innerText.replace(/\\s+/g, ' '))`)) evidence.push(`ubuntu: ${w}`)
    evidence.push(`screen: ${await shot('compatibility')}`)
    if (await has('compat-update')) {
      evidence.push(`behind: ${await testText('onboarding-fix-native-update')}`)
      if (!flag('--update')) return { status: 'SKIP', evidence: [...evidence, 'Update Claude Code offered, not run without --update (it really updates this computer\'s Claude)'] }
      await click(page, { css: '[data-testid="onboarding-fix-native-update-run"]' })
      // PowerShell never closes the terminal: wait for the updater's LAST word, then Check again.
      // Not "Current version", which it prints first: taking that for the end pressed Check
      // again mid-update and read the old version (the first real run, 2026-10-06).
      const FINISHED = /Successfully updated|is up to date|already (?:on the )?latest|Update failed|Failed to (?:update|install)/i
      await waitFor(async () => FINISHED.test(await xtermText('onboarding-fix-native-update-terminal')), { timeoutMs: 10 * 60_000, intervalMs: 3000, what: 'the updater to finish' })
        .catch(() => waitForPerson('let Claude Code\'s updater finish in the terminal on the compatibility page', async () => FINISHED.test(await xtermText('onboarding-fix-native-update-terminal'))))
      await sleep(2000)
      evidence.push(`updater: ${(await xtermText('onboarding-fix-native-update-terminal')).split(/\r?\n/).filter(Boolean).slice(-3).join(' / ')}`)
      await click(page, { within: '[data-testid="onboarding-fix-native-update-terminal"]', text: 'Check again', exact: true })
      await waitFor(async () => /Everything will work as expected/.test(await text()), { timeoutMs: 60_000, what: 'the page to say Everything will work as expected' })
      evidence.push(`after: ${((await text()).match(/You're on Claude Code [^\n]*/) ?? ['?'])[0]}`, `screen: ${await shot('compatibility-updated')}`)
    }
    for (const id of await page.evaluate(`[...document.querySelectorAll('[data-testid^="onboarding-fix-wsl-update-"][data-testid$="-run"]')].map((e) => e.dataset.testid)`)) {
      if (!flag('--update')) { evidence.push(`Ubuntu behind, its update not run without --update (${id})`); continue }
      await click(page, { css: `[data-testid="${id}"]` })
      await waitFor(async () => !(await has(id)), { timeoutMs: 10 * 60_000, intervalMs: 3000, what: 'the Ubuntu update to finish' })
      evidence.push(`Ubuntu updated: ${(await page.evaluate(`[...document.querySelectorAll('[data-testid="compat-wsl"]')].map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' / ')`))}`)
    }
    const good = /Everything will work as expected/.test(await text()) && !(await has('compat-update'))
    return { status: good ? 'PASS' : 'FAIL', evidence }
  })

  // ── 8. The end of the first page ───────────────────────────────────────────────────────────
  await step(out, `${P}.set-up-done`, 'The Set up page ends on the Account page', async () => {
    if (await exists(page, { text: 'Next →', exact: true })) await press('Next →')
    else await press('Continue anyway →')
    await waitFor(async () => /Got more than one Claude account\?/.test(await text()), { timeoutMs: 30_000, what: 'the Account page' })
    return { evidence: [`screen: ${await shot('account-page')}`] }
  })
} finally {
  page.close()
}
