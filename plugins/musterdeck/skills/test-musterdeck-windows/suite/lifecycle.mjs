#!/usr/bin/env node
/**
 * lifecycle.mjs -- drive whole sessions through the app, the way a person would, and record
 * what happened (WSL parity P9). One place per run: an Ubuntu environment or this machine.
 *
 *   node suite/lifecycle.mjs --port 9339 --out <dir> --place ubuntu|native --folder <folder>
 *        [--claude] [--drop <a file on this machine>] [--phase main|resume] [--timeout-s 180]
 *
 * `--folder` is in the place's own form: a Linux folder for Ubuntu, this machine's for native.
 *
 * Phase `main` (the default):
 *   shell      a Shell-only session from the New Session dialog: its record, host and prompt
 *   colour     TERM and COLORTERM in it, none of the variables a Claude Code host sets for its own
 *              shells (NO_COLOR above all), then truecolour blocks, read back from a screenshot of
 *              the window (pixels counted near the exact colours sent); the PNG is kept
 *   drop       what dropping `--drop` on it would type (the drop handler, dry run)
 *   rename     Rename from the sidebar menu: the label changes
 *   split      Split right from the tab menu, both terminals still alive, then Merge panes
 *   archive    Archive from the tab menu (that session's own menu), Restore from that session's
 *              row in the sidebar's Archived Sessions: the same session, a live shell
 *   archive-card  the sidebar card's button archives (1.0.106): only that session goes, it is
 *              listed under Archived Sessions, and its row restores it (SKIP on an older build)
 *   close      Close Session from the sidebar menu takes two clicks, and closes (not archives)
 *   close-all  Close All on a two-session selection asks first: Cancel keeps both, OK closes both
 *   With `--claude` (spends a few cheap turns on the account):
 *   claude     a Claude session with a Partner Terminal, ready (a folder trust question, if
 *              Claude asks one, is answered with its "Yes" option, found on screen and moved to
 *              with the arrow keys; never a bare Enter, since some versions list "No, exit" first)
 *   turn       one prompt with a marker word: Working is seen on the deck, then it settles,
 *              and the reply is the marker, read AFTER the prompt on screen
 *   scheduled  "Schedule a message..." from the tab menu, due now: a `/rename` (a local command,
 *              no tokens) is typed in, and the label follows it
 *   partner    the Partner Terminal opens in the session's folder (`pwd`)
 *   play       1.0.136: Claude is asked for a code block whose command prints a random number;
 *              its Play button appears, a click runs it in the Terminal, and after "done" Claude
 *              answers with the number, which only the note on that message could tell it
 *              (two short turns; SKIP on an older build)
 *   rename     as above, for the Claude session
 *   restart    Restart on the status strip: a new terminal, the same conversation (the marker
 *              comes back from the transcript, the conversation id is unchanged)
 *   archive    Archive from the tab menu, then Restore from the sidebar's Archived Sessions:
 *              the same session id and conversation
 *   The ids, the marker and the conversation are saved in `<out>/lifecycle-<place>.json`.
 *
 * Phase `resume`, after the app was quit (quit-app.mjs) and started again with the same data
 * folder: the sessions are back with their labels, and the Claude session continues the SAME
 * conversation: its id is unchanged and, asked, it answers the marker again (a reply after
 * that question on screen, not the replayed one from before the relaunch).
 *
 * Every step records PASS, FAIL or SKIP with evidence lines (lib/results.mjs). Exit 1 when
 * any step failed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, step, record, failWith } from './lib/results.mjs'
import {
  click, contextMenu, setValue, pressKey, setChecked, exists, rectOf, sleep, waitFor,
  terminalText, typeInTerminal, pressTerminalKey, waitForTerminal, screenshot,
} from './lib/ui.mjs'
import { decodePng, countNear } from './lib/png.mjs'
import { TRUST, CLAUDE_READY, offerOnScreen, selectPrompt, describeOptions, countAnswers, answersAfterPrompt } from './lib/claude-tui.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const port = portFromArgs()
const out = outDirFromArgs() ?? fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'md-lifecycle-'))
const place = arg('--place', 'native')
const folder = arg('--folder')
const withClaude = argv.includes('--claude')
const dropFile = arg('--drop')
const phase = arg('--phase', 'main')
const timeoutMs = Number(arg('--timeout-s', 180)) * 1000
const statePath = path.join(out, `lifecycle-${place}.json`)

if (!['ubuntu', 'native'].includes(place) || !folder) {
  console.error('usage: lifecycle.mjs --port <n> --out <dir> --place ubuntu|native --folder <folder> [--claude] [--drop <file>] [--phase main|resume]')
  process.exit(2)
}

const P = `lifecycle.${place}`
let failed = 0
async function run(id, title, fn) {
  const r = await step(out, `${P}.${id}`, title, fn)
  if (r.status === 'FAIL') failed++
  return r
}

const page = await connectToApp(port)
const platform = await page.evaluate('window.electronPlatform || null')
const stamp = Date.now().toString(36).slice(-5)

/** The Ubuntu environment in use, or null for native. */
async function wslEnvironment() {
  const e = await callTestApi(page, 'environments')
  return (e?.environments ?? []).find((x) => x.kind === 'wsl' && (!arg('--environment') || x.id === arg('--environment'))) ?? null
}
const env = place === 'ubuntu' ? await wslEnvironment() : null
if (place === 'ubuntu' && !env) {
  record(out, { id: `${P}.setup`, title: 'An Ubuntu environment to run in', status: 'FAIL', evidence: ['No WSL environment is set up in this app (run setup-environment.mjs first)'] })
  page.close()
  process.exit(1)
}
/** POSIX shell in Ubuntu and on macOS/Linux; PowerShell for a Windows session. */
const powershell = place === 'native' && platform === 'win32'
const sessions = () => callTestApi(page, 'sessions')
const sessionById = async (id) => (await sessions()).find((s) => s.id === id) ?? null

/** Show the Chat view, where the sidebar, the tabs and the terminals live. */
async function toChat() {
  if (await exists(page, { css: 'button[aria-label="Chat"]' })) await click(page, { css: 'button[aria-label="Chat"]' })
  await sleep(300)
}

/** Make a session the active one by clicking its tab. */
async function activate(id) {
  await toChat()
  await click(page, { css: `[data-session-id="${id}"] button` })
  await waitFor(async () => (await callTestApi(page, 'activeSession'))?.id === id, { timeoutMs: 10_000, what: `${id} to be the active session` })
  await sleep(400)
}

/** New Session dialog -> a session. Returns its record. */
async function createSession({ label, shellOnly, partner }) {
  await toChat()
  const before = new Set((await sessions()).map((s) => s.id))
  // The Active Sessions header's "+" (always there), else the empty list's own button.
  const plus = { within: 'aside', css: 'button[title="New session (no saved config needed)"]' }
  await click(page, (await exists(page, plus)) ? plus : { within: 'aside', text: 'Create a new session' })
  const dialog = '[role="dialog"][aria-label="New Session"]'
  await waitFor(() => exists(page, { css: dialog }), { timeoutMs: 10_000, what: 'the New Session dialog' })
  const placeLabel = place === 'ubuntu' ? env.label : null
  if (await exists(page, { css: '[data-testid="environment-switch"]' })) {
    if (placeLabel) {
      await click(page, { within: '[data-testid="environment-switch"]', text: placeLabel, startsWith: true })
    } else {
      // This machine: the place that is neither SSH nor a WSL environment.
      const e = await callTestApi(page, 'environments')
      const wslLabels = (e?.environments ?? []).filter((x) => x.kind === 'wsl').map((x) => x.label)
      const labels = await page.evaluate(`Array.from(document.querySelectorAll('[data-testid="environment-switch"] button')).map((b) => b.textContent.replace('Primary', '').trim())`)
      const nativeLabel = labels.find((l) => l !== 'SSH' && !wslLabels.includes(l))
      if (!nativeLabel) throw new Error(`no place for this machine in the switch (${labels.join(', ')})`)
      await click(page, { within: '[data-testid="environment-switch"]', text: nativeLabel, startsWith: true })
    }
  } else if (placeLabel) {
    throw new Error('the New Session dialog has no place switch, so an Ubuntu session cannot be chosen')
  }
  await setValue(page, { near: 'Label', within: dialog }, label)
  await setValue(page, { near: placeLabel ? `Folder in ${placeLabel}` : 'Working Directory', within: dialog }, folder)
  if (!(await exists(page, { checkboxText: 'Shell only', within: dialog }))) await click(page, { within: dialog, text: 'Session Options' })
  await setChecked(page, { checkboxText: 'Shell only', within: dialog }, !!shellOnly)
  if (!shellOnly && partner) await setChecked(page, { checkboxText: 'Partner Terminal', within: dialog }, true)
  await click(page, { within: dialog, css: 'button[type="submit"]', text: 'Create', exact: true })
  const s = await waitFor(async () => (await sessions()).find((x) => !before.has(x.id) && x.label === label), { timeoutMs: 20_000, what: `a session labelled ${label}` })
  await waitFor(async () => !(await exists(page, { css: dialog })), { timeoutMs: 10_000, what: 'the dialog to close' })
  return s
}


/**
 * Answer Claude's folder trust question with its "Yes" option, wherever that option is. Never
 * a blind Enter: Claude Code 2.1.287 lists "No, exit" first and selected, so Enter quit
 * Claude. Reads the options off the screen, moves the cursor onto Yes with the arrow keys,
 * checks the cursor is there, and only then presses Enter. Answers the options as seen.
 */
async function answerTrust(ptyId) {
  return answerOption(ptyId, 'the trust question', (sp) => sp.yes, 'Yes')
}

/** Move the cursor of the select prompt on screen onto the option `pick` names, check, Enter. */
async function answerOption(ptyId, what, pick, optionName) {
  for (let i = 0; i < 8; i++) {
    const sp = selectPrompt(await terminalText(page, ptyId, 60))
    if (!sp) throw new Error(`${what} shows no options yet`)
    const want = pick(sp)
    if (!want) throw new Error(`${what} has no ${optionName} option (${describeOptions(sp)})`)
    if (!sp.selected) throw new Error(`cannot tell which option of ${what} is selected (${describeOptions(sp)})`)
    if (sp.selected.n === want.n) {
      await typeInTerminal(page, ptyId, '', { enter: true })
      return sp
    }
    await pressTerminalKey(page, ptyId, want.n > sp.selected.n ? 'ArrowDown' : 'ArrowUp')
    await sleep(400)
  }
  throw new Error(`the cursor would not move onto the ${optionName} option of ${what}`)
}

/**
 * Wait for Claude's prompt in a terminal; answers a folder trust question Yes if one shows, and
 * declines Claude's own offers (`OFFERS`): accepting one would change the person's settings.
 */
async function waitClaudeReady(ptyId) {
  let trusted = null
  const declined = []
  return waitFor(async () => {
    const t = await terminalText(page, ptyId)
    const tail = t.split(/\r?\n/).slice(-40).join('\n')
    const offer = offerOnScreen(t)
    if (offer && !declined.includes(offer.name)) {
      await answerOption(ptyId, `the offer of ${offer.name}`, (sp) => sp.options.find((o) => offer.decline.test(o.text)), 'decline')
      declined.push(offer.name)
      return null
    }
    if (!trusted && TRUST.test(tail) && !CLAUDE_READY.test(tail)) {
      trusted = await answerTrust(ptyId)
      return null
    }
    return CLAUDE_READY.test(t) && !offerOnScreen(t) ? { text: t, trusted, declined } : null
  }, { timeoutMs, intervalMs: 1000, what: `Claude's prompt in ${ptyId}` })
}

/**
 * A name chosen in the sidebar is still the session's name a while after `what` (two reading
 * polls, 5 s each, so an older transcript title would have had its chance to come back).
 * The 2026-10-06 Windows run: both Claude sessions took their older /rename title back right
 * after Restart, and these steps passed because they only checked the conversation.
 */
async function labelSurvives(id, label, what, evidence) {
  if (!label) return
  await sleep(11_000)
  const now = (await sessionById(id))?.label
  evidence.push(`label after ${what}: "${now}"`)
  if (now !== label) throw failWith(`the name chosen in the sidebar did not survive ${what}`, [...evidence, `expected "${label}"`])
}

/** The conversation a Claude session is on: the reading's uuid, else its resume pointer. */
async function conversationOf(id) {
  const tk = await callTestApi(page, 'tokenomics', 5).catch(() => null)
  return tk?.open?.find((o) => o.id === id)?.uuid ?? (await sessionById(id))?.resumeUuid ?? null
}

/**
 * Type a prompt and watch the deck until the turn is over. Answers the statuses seen. The
 * reply must come AFTER this prompt on screen (`answersAfterPrompt`): a resumed session
 * replays the earlier replies too, and a counter taken before typing raced that replay.
 */
async function turn(id, prompt, marker) {
  await typeInTerminal(page, id, prompt)
  const seen = []
  await waitFor(async () => {
    const st = (await callTestApi(page, 'readings'))?.status?.[id] ?? 'none'
    if (seen[seen.length - 1] !== st) seen.push(st)
    const n = answersAfterPrompt(await terminalText(page, id), prompt, marker)
    return n > 0 && st !== 'working' && st !== 'spawning' ? true : null
  }, { timeoutMs, intervalMs: 400, what: `the reply ${marker} after the prompt, and the turn to settle` })
  return seen
}

/** Rename through the sidebar's menu. */
async function renameViaSidebar(id, label) {
  await toChat()
  // The Active Sessions row (the deck above lists the session too, without this menu).
  await contextMenu(page, { css: `[data-session-row="${id}"]`, last: true })
  await click(page, { text: 'Rename', exact: true })
  const input = { css: `input[data-session-rename="${id}"]` }
  await setValue(page, input, label)
  await pressKey(page, input, 'Enter')
  return waitFor(async () => (await sessionById(id))?.label === label, { timeoutMs: 10_000, what: `the label ${label}` })
}

/**
 * Open a session's TAB menu and click one of its items. Scoped to that menu: since 1.0.106
 * "Archive session" is also the sidebar card's button and the session header's, and a
 * page-wide match archived whichever session came first. The tab menu is the one whose
 * items include "Hide session tab", which no other menu has.
 */
async function tabMenuItem(id, item) {
  await contextMenu(page, { css: `[data-session-id="${id}"]` })
  await waitFor(() => page.evaluate(`(() => {
    const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim()
    const menus = Array.from(document.querySelectorAll('button')).filter((b) => norm(b.textContent) === 'Hide session tab').map((b) => b.parentElement)
    for (const m of menus) {
      const el = Array.from(m.querySelectorAll(':scope > button')).find((b) => norm(b.textContent) === ${JSON.stringify(item)})
      if (el) { el.click(); return true }
    }
    return false
  })()`), { timeoutMs: 10_000, intervalMs: 250, what: `"${item}" in the tab menu of ${id}` })
}

/** Open the sidebar's Archived Sessions list (it may be collapsed). */
async function openArchived() {
  await toChat()
  await waitFor(() => page.evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('aside button')).find((x) => /^Archived Sessions/i.test(x.textContent.replace(/\\s+/g, ' ').trim()))
    if (!b) return false
    if (b.getAttribute('aria-expanded') === 'false') b.click()
    return true
  })()`), { timeoutMs: 15_000, intervalMs: 250, what: 'the Archived Sessions list' })
  await sleep(400)
}

/** The titles of the rows in Archived Sessions (each is the session's label when archived). */
async function archivedTitles() {
  await openArchived()
  return page.evaluate(`(() => {
    const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim()
    return Array.from(document.querySelectorAll('aside button')).filter((b) => norm(b.textContent) === 'Restore')
      .map((b) => { const t = b.parentElement.querySelector(':scope > div > div'); return norm(t ? t.textContent : b.parentElement.textContent) })
  })()`)
}

/** Click Restore on THIS session's row in Archived Sessions (by its label), not the first row. */
async function restoreArchived(label) {
  await openArchived()
  await waitFor(() => page.evaluate(`(() => {
    const norm = (s) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim()
    const want = ${JSON.stringify(label)}
    const rows = Array.from(document.querySelectorAll('aside button')).filter((b) => norm(b.textContent) === 'Restore').map((b) => b.parentElement)
    const row = rows.find((r) => { const t = r.querySelector(':scope > div > div'); return t ? norm(t.textContent) === want : norm(r.textContent).startsWith(want) })
    if (!row) return false
    Array.from(row.querySelectorAll('button')).find((b) => norm(b.textContent) === 'Restore').click()
    return true
  })()`), { timeoutMs: 15_000, intervalMs: 500, what: `the archived row "${label}"` })
}

/** Restore a session by its row and wait for it to be back with its id. Answers the record. */
async function restoreAndWait(id, label) {
  const titles = await archivedTitles()
  if (!titles.includes(label)) throw failWith(`"${label}" is not in Archived Sessions`, [`rows: ${titles.join('; ') || '(none)'}`])
  await restoreArchived(label)
  const back = await waitFor(() => sessionById(id), { timeoutMs: 20_000, what: 'the session to come back with its id' })
  await activate(id)
  return back
}

/** Archive from the tab menu, then Restore from the sidebar's Archived Sessions. Answers the record. */
async function archiveAndRestore(id) {
  await activate(id)
  const label = (await sessionById(id))?.label
  const others = (await sessions()).filter((s) => s.id !== id).map((s) => s.id)
  await tabMenuItem(id, 'Archive session')
  await waitFor(async () => !(await sessionById(id)), { timeoutMs: 20_000, what: 'the session to leave Active Sessions' })
  const all = (await sessions()).map((s) => s.id)
  const lost = others.filter((o) => !all.includes(o))
  if (lost.length) throw failWith('archiving one session took another with it', [`gone too: ${lost.join(', ')}`])
  return restoreAndWait(id, label)
}

/** A shell command that prints `text` on a line of its own. */
const echo = (text) => `echo ${text}`

/** Read the window back and count the colours a truecolour block drew. */
async function colourCheck(id) {
  const evidence = []
  const envLine = powershell ? 'echo "TERM=$env:TERM COLORTERM=$env:COLORTERM"' : 'echo "TERM=$TERM COLORTERM=$COLORTERM"'
  await typeInTerminal(page, id, envLine)
  const t = await waitForTerminal(page, id, /^TERM=\S* COLORTERM=\S*\s*$/m, { timeoutMs: 20_000, what: 'the TERM line' })
  const line = t.match(/^TERM=\S* COLORTERM=\S*\s*$/m)[0].trim()
  evidence.push(`terminal says: ${line}`)
  const termOk = /TERM=xterm-256color/.test(line) && /COLORTERM=truecolor/.test(line)
  // What the Claude Code session that started the app set for its OWN tool shells must not reach
  // a session: NO_COLOR=1 drew every Windows Claude session white while the blocks below still
  // passed (raw escapes ignore it), DISABLE_AUTOUPDATER froze its Claude, GIT_EDITOR=true would
  // commit with no editor (1.0.162; the app drops them at start from 1.0.164).
  const hostVars = ['NO_COLOR', 'GIT_EDITOR', 'DISABLE_AUTOUPDATER', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']
  const hostLine = powershell
    ? `echo ("HOSTVARS=[" + ((@(${hostVars.map((v) => `'${v}'`).join(',')}) | Where-Object { Test-Path "env:$_" }) -join ' ') + "]")`
    : `echo "HOSTVARS=[$(for v in ${hostVars.join(' ')}; do printenv "$v" >/dev/null && printf '%s ' "$v"; done)]"`
  await typeInTerminal(page, id, hostLine)
  const ht = await waitForTerminal(page, id, /^HOSTVARS=\[[^\]]*\]\s*$/m, { timeoutMs: 20_000, what: 'the HOSTVARS line' })
  const inherited = ht.match(/^HOSTVARS=\[([^\]]*)\]\s*$/m)[1].trim()
  evidence.push(`a Claude Code host's own shell variables in the session: ${inherited || 'none'}`)
  const orange = [255, 100, 0], blue = [0, 120, 255]
  const block = (rgb) => powershell
    ? `$e=[char]27; 1..3 | % { "$e[48;2;${rgb.join(';')}m" + (' ' * 60) + "$e[0m" }`
    : `for i in 1 2 3; do printf '\\033[48;2;${rgb.join(';')}m%60s\\033[0m\\n' ''; done`
  await typeInTerminal(page, id, block(orange))
  await typeInTerminal(page, id, block(blue))
  await sleep(1500)
  const png = await screenshot(page)
  const file = path.join(out, `colour-${place}.png`)
  fs.writeFileSync(file, png)
  const img = decodePng(png)
  // Windows draws terminal colours as sent (the app's colour profile, T8b), so they must come
  // back exact. macOS colour-manages the window to the display, which moves them a little.
  const tolerance = platform === 'win32' ? 6 : 64
  const o = countNear(img, orange, tolerance), b = countNear(img, blue, tolerance)
  evidence.push(`screenshot ${path.basename(file)} ${img.width}x${img.height}, tolerance ${tolerance}: orange ${orange.join(',')} ${o.count} px (nearest ${o.nearest?.join(',')}), blue ${blue.join(',')} ${b.count} px (nearest ${b.nearest?.join(',')})`)
  const drawn = o.count >= 500 && b.count >= 500
  if (!termOk || !drawn || inherited) {
    throw failWith(
      !termOk ? `expected TERM=xterm-256color COLORTERM=truecolor, got "${line}"`
        : inherited ? `the session inherited what the Claude Code session that started the app set for its own shells (${inherited}): Claude draws without colour under NO_COLOR`
          : 'the truecolour blocks are not in the screenshot at their exact colours',
      evidence)
  }
  return { evidence }
}

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {}
const saveState = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2))

if (phase === 'main') {
  state.place = place
  state.folder = folder
  state.environmentId = env?.id ?? null
  state.marker = state.marker ?? `mdsuite${stamp}`.replace(/[^a-z0-9]/g, '')

  // ---- the shell session -------------------------------------------------------------
  let shell = null
  await run('shell', 'A Shell-only session from the New Session dialog', async () => {
    shell = await createSession({ label: `md-suite ${place} shell ${stamp}`, shellOnly: true })
    state.shell = { id: shell.id, label: shell.label }
    saveState()
    const wantHost = place === 'ubuntu' ? 'wsl' : 'native'
    if (shell.host !== wantHost) throw new Error(`host is ${shell.host}, expected ${wantHost}`)
    if (place === 'ubuntu' && shell.environmentId !== env.id) throw new Error(`environment ${shell.environmentId}, expected ${env.id}`)
    await activate(shell.id)
    const t = await waitFor(async () => { const x = await terminalText(page, shell.id); return x.trim().length > 0 ? x : null }, { timeoutMs, what: 'a shell prompt' })
    // A shell can drop the first keystrokes while its line editor is still starting (seen on
    // macOS zsh, 1.0.126 run): retype up to three times before calling it dead.
    const alive = new RegExp(`^md-suite-alive-${stamp}\\s*$`, 'm')
    let tries = 0
    for (;;) {
      tries++
      await typeInTerminal(page, shell.id, echo(`md-suite-alive-${stamp}`))
      try { await waitForTerminal(page, shell.id, alive, { timeoutMs: 12_000 }); break } catch (e) { if (tries >= 3) throw e }
    }
    return { evidence: [`answered after ${tries} attempt(s)`, `session ${shell.id} host ${shell.host}${shell.environmentId ? ` ${shell.environmentId}` : ''} in ${shell.workingDirectory}`, `first output: ${t.trim().split('\n').pop()}`] }
  })

  if (shell) {
    await run('colour', 'Colour env and truecolour, sampled from a screenshot', async () => {
      await activate(shell.id)
      return colourCheck(shell.id)
    })

    await run('drop', 'A dropped file types the path the session can open', async () => {
      if (!dropFile) return { status: 'SKIP', evidence: ['no --drop file given'] }
      const r = await callTestApi(page, 'dropPlan', shell.id, [dropFile])
      if (!r || r.plan?.kind !== 'paste' || !r.plan.text) throw failWith('the drop would type nothing', [JSON.stringify(r)])
      const text = r.plan.text
      // This machine's form is the shell's own quoting (backslash-escaped spaces, or quotes).
      const plainText = text.replace(/\\(.)/g, '$1').replace(/['"]/g, '')
      const ok = place === 'ubuntu' ? /^'\/mnt\/[a-z]\//.test(text) && plainText.includes(path.basename(dropFile)) : plainText.includes(path.basename(dropFile))
      if (!ok) throw failWith(`the drop would type ${text}`, [JSON.stringify(r.plan)])
      return { evidence: [`${dropFile} -> ${text}`] }
    })

    await run('rename', 'Rename from the sidebar', async () => {
      const label = `md-suite ${place} renamed ${stamp}`
      await renameViaSidebar(shell.id, label)
      state.shell.label = label
      saveState()
      return { evidence: [`label is now "${label}"`] }
    })

    await run('split', 'Split right, both terminals live, then merge', async () => {
      await activate(shell.id)
      await tabMenuItem(shell.id, 'Split right')
      const lay = await waitFor(async () => { const l = await callTestApi(page, 'layout'); return l?.splitEnabled ? l : null }, { timeoutMs: 10_000, what: 'split panes' })
      const pane = lay.paneOf?.[shell.id] ?? null
      const terms = await callTestApi(page, 'terminals')
      await typeInTerminal(page, shell.id, echo(`md-suite-split-${stamp}`))
      await waitForTerminal(page, shell.id, new RegExp(`^md-suite-split-${stamp}\\s*$`, 'm'), { timeoutMs: 20_000 })
      await click(page, { css: 'button[title="Merge panes"]' })
      await waitFor(async () => !(await callTestApi(page, 'layout'))?.splitEnabled, { timeoutMs: 10_000, what: 'the panes to merge' })
      if (pane !== 'right') throw failWith(`the session is in the ${pane} pane, not the right`, [JSON.stringify(lay.paneOf)])
      return { evidence: [`split: ${shell.id} in the right pane, ${terms.length} terminal(s) live, typing still reached it; merged again`] }
    })

    await run('archive', 'Archive, then Restore from the sidebar', async () => {
      const back = await archiveAndRestore(shell.id)
      await waitFor(async () => (await terminalText(page, shell.id)).trim().length > 0, { timeoutMs: 60_000, what: 'a prompt in the restored shell' })
      await typeInTerminal(page, shell.id, echo(`md-suite-back-${stamp}`))
      await waitForTerminal(page, shell.id, new RegExp(`^md-suite-back-${stamp}\\s*$`, 'm'), { timeoutMs: 30_000 })
      return { evidence: [`restored ${back.id} "${back.label}", its shell answers again`] }
    })

    await run('archive-card', "The sidebar card's button archives (not closes), and Restore brings it back", async () => {
      await toChat()
      const sel = `[data-session-archive="${shell.id}"]`
      if (!(await exists(page, { css: sel, visible: false }))) return { status: 'SKIP', evidence: ['no archive button on the sidebar card (a build before 1.0.106)'] }
      const label = (await sessionById(shell.id)).label
      const others = (await sessions()).filter((s) => s.id !== shell.id).map((s) => s.id)
      // Hover the row and click the button where it is drawn, as a person would.
      const box = await rectOf(page, { css: sel, visible: false })
      const x = box.x + box.width / 2, y = box.y + box.height / 2
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
      await sleep(300)
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
      await waitFor(async () => !(await sessionById(shell.id)), { timeoutMs: 20_000, what: 'the session to leave Active Sessions' })
      const all = (await sessions()).map((s) => s.id)
      if (others.some((o) => !all.includes(o))) throw failWith('the card button took another session with it', [`gone: ${others.filter((o) => !all.includes(o)).join(', ')}`])
      // Archived, not closed: it is listed under Archived Sessions, which a close never does.
      const back = await restoreAndWait(shell.id, label)
      await waitFor(async () => (await terminalText(page, shell.id)).trim().length > 0, { timeoutMs: 60_000, what: 'a prompt in the restored shell' })
      return { evidence: [`the card button archived ${shell.id} "${label}" and only it`, `listed under Archived Sessions and restored from its own row: ${back.id}`] }
    })

    await run('close', 'Close Session from the sidebar menu asks first (two clicks)', async () => {
      const s = await createSession({ label: `md-suite ${place} close ${stamp}`, shellOnly: true })
      await toChat()
      await contextMenu(page, { css: `[data-session-row="${s.id}"]`, last: true })
      await click(page, { text: 'Close Session', exact: true })
      await sleep(500)
      const stillOpen = !!(await sessionById(s.id))
      const armed = await exists(page, { text: 'Close? Click again', exact: true })
      if (!stillOpen) throw failWith('one click closed it, with no second step', [`session ${s.id}`])
      if (!armed) throw failWith('the first click did not arm the close', [`session ${s.id} is still open, but the menu does not say "Close? Click again"`])
      await click(page, { text: 'Close? Click again', exact: true })
      await waitFor(async () => !(await sessionById(s.id)), { timeoutMs: 10_000, what: 'the session to close' })
      const archived = await archivedTitles().catch(() => [])
      if (archived.includes(s.label)) throw failWith('the closed session was archived instead', [`"${s.label}" is under Archived Sessions`])
      return { evidence: [`first click: still open, the item reads "Close? Click again"`, `second click: ${s.id} closed (not archived)`] }
    })

    await run('close-all', 'Close All on a selection asks first: Cancel keeps them, OK closes them', async () => {
      const a = await createSession({ label: `md-suite ${place} bulk-a ${stamp}`, shellOnly: true })
      const b = await createSession({ label: `md-suite ${place} bulk-b ${stamp}`, shellOnly: true })
      await toChat()
      if (await exists(page, { within: 'aside', text: 'Clear', exact: true })) await click(page, { within: 'aside', text: 'Clear', exact: true })
      // The confirm is the browser's own dialog, which CDP cannot click in Electron: answer it
      // in the page, record what it asked, and put the real one back afterwards.
      await page.evaluate(`(() => { window.__mdConfirm = { asked: [], answer: false, orig: window.__mdConfirm?.orig ?? window.confirm }; window.confirm = (m) => { window.__mdConfirm.asked.push(String(m)); return window.__mdConfirm.answer } })()`)
      const mod = platform === 'darwin' ? 'metaKey' : 'ctrlKey'
      const select = async () => {
        for (const id of [a.id, b.id]) {
          await page.evaluate(`document.querySelector('button[data-session-row="${id}"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ${mod}: true }))`)
          await sleep(200)
        }
      }
      try {
        await select()
        await click(page, { within: 'aside', text: 'Close All', exact: true })
        await sleep(500)
        const keptOnCancel = !!(await sessionById(a.id)) && !!(await sessionById(b.id))
        await page.evaluate('window.__mdConfirm.answer = true')
        if (!(await exists(page, { within: 'aside', text: 'Close All', exact: true }))) await select()
        await click(page, { within: 'aside', text: 'Close All', exact: true })
        await waitFor(async () => !(await sessionById(a.id)) && !(await sessionById(b.id)), { timeoutMs: 10_000, what: 'both sessions to close' })
        const asked = await page.evaluate('window.__mdConfirm.asked')
        const evidence = [`asked: ${JSON.stringify(asked[0] ?? null)}`, `after Cancel both still open: ${keptOnCancel}`, `after OK both closed`]
        if (!asked.length) throw failWith('Close All closed them without asking', evidence)
        if (!keptOnCancel) throw failWith('Cancel did not keep them', evidence)
        if (!/\b2\b/.test(asked[0])) throw failWith('the question does not say how many sessions', evidence)
        return { evidence }
      } finally {
        await page.evaluate('(() => { if (window.__mdConfirm?.orig) window.confirm = window.__mdConfirm.orig })()').catch(() => {})
      }
    })
  }

  // ---- the Claude session --------------------------------------------------------------
  if (!withClaude) {
    record(out, { id: `${P}.claude`, title: 'A Claude session (turn, partner, restart, archive)', status: 'SKIP', evidence: ['not asked for (--claude)'] })
  } else {
    let claude = null
    await run('claude', 'A Claude session with a Partner Terminal, ready', async () => {
      claude = await createSession({ label: `md-suite ${place} claude ${stamp}`, shellOnly: false, partner: true })
      state.claude = { id: claude.id, label: claude.label }
      saveState()
      await activate(claude.id)
      const r = await waitClaudeReady(claude.id)
      return { evidence: [`session ${claude.id} host ${claude.host}${claude.environmentId ? ` ${claude.environmentId}` : ''}`, r.trusted ? `answered the folder trust question with ${r.trusted.yes.n}. ${r.trusted.yes.text} (options: ${describeOptions(r.trusted)})` : 'no trust question', ...r.declined.map((d) => `declined Claude's offer of ${d} (Not now: it would change the person's settings)`)] }
    })

    if (claude) {
      await run('turn', 'One turn: Working on the deck, then settled, with the marker as the reply', async () => {
        await activate(claude.id)
        const seen = await turn(claude.id, `Reply with only the single word ${state.marker} and nothing else. Do not use any tools.`, state.marker)
        state.conversation = await conversationOf(claude.id)
        saveState()
        const evidence = [`statuses seen: ${seen.join(' > ')}`, `conversation ${state.conversation ?? 'unknown'}`]
        if (!seen.includes('working')) throw failWith('the deck never showed Working during the turn', evidence)
        return { evidence }
      })

      await run('scheduled', 'A scheduled message is typed in when due', async () => {
        // A local command, so it spends nothing: /rename prints "Session renamed to: <name>",
        // which the app reads straight from the terminal into the session's label.
        await activate(claude.id)
        // Spaces on purpose: Claude draws them as cursor moves, which ran the words together
        // in the label until 1.0.109.
        const name = `md-suite sched ${stamp}`
        await tabMenuItem(claude.id, 'Schedule a message…')
        await setValue(page, { css: 'input[maxlength]' }, `/rename ${name}`)
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        if (await exists(page, { css: 'input[type="datetime-local"]' })) {
          await setValue(page, { css: 'input[type="datetime-local"]' }, `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`)
        }
        await click(page, { text: 'Schedule', exact: true })
        const t0 = Date.now()
        await waitFor(async () => (await sessionById(claude.id))?.label === name, { timeoutMs: 90_000, what: `the scheduled /rename to set the label ${name}` })
        state.claude.label = name
        saveState()
        return { evidence: [`"/rename ${name}" was typed in ${Math.round((Date.now() - t0) / 1000)}s after it was scheduled for now; the label followed`] }
      })

      await run('partner', "The Partner Terminal opens in the session's folder", async () => {
        await activate(claude.id)
        await click(page, { css: 'button[aria-label="Open Terminal"]' })
        const pid = `${claude.id}-partner`
        await waitFor(async () => (await callTestApi(page, 'terminals')).includes(pid), { timeoutMs: 20_000, what: 'the partner terminal' })
        await waitFor(async () => (await terminalText(page, pid)).trim().length > 0, { timeoutMs: 60_000, what: 'a prompt in the partner terminal' })
        await typeInTerminal(page, pid, 'pwd')
        const want = folder.replace(/[\\/]+$/, '')
        const t = await waitFor(async () => {
          const x = await terminalText(page, pid)
          return x.toLowerCase().includes(want.toLowerCase()) && x.split('\n').some((l) => l.trim().toLowerCase().endsWith(want.toLowerCase()) && !/pwd/.test(l)) ? x : null
        }, { timeoutMs: 20_000, what: `pwd to print ${want}` })
        const line = t.split('\n').map((l) => l.trim()).filter((l) => l.toLowerCase().endsWith(want.toLowerCase()) && !/pwd/.test(l)).pop()
        const evidence = [`pwd in ${pid}: ${line}`]
        // 1.0.121 rolls the terminal up from the bottom under Claude; before, it replaced Claude.
        if (await exists(page, { css: '[aria-label="Resize the terminal"]' })) {
          // `page.evaluate` takes an expression (lib/cdp.mjs), not a function.
          const shape = await page.evaluate(`(() => {
            const edge = document.querySelector('[aria-label="Resize the terminal"]')
            const drawer = edge && edge.parentElement
            const pane = drawer && drawer.parentElement
            const r = drawer && drawer.getBoundingClientRect(), pr = pane && pane.getBoundingClientRect()
            return { ratio: r && pr && pr.height ? r.height / pr.height : null }
          })()`)
          evidence.push(`drawer: ${shape.ratio == null ? 'unmeasured' : Math.round(shape.ratio * 100) + '% of the pane'}, Claude above it`)
          if (shape.ratio != null && (shape.ratio < 0.15 || shape.ratio > 0.5)) throw failWith('the terminal drawer is not about 30% of the pane', evidence)
          await click(page, { css: 'button[aria-label="Hide Terminal"]' })
        } else {
          await click(page, { css: 'button[aria-label="Switch back to Claude"]' })
        }
        return { evidence }
      })

      await run('play', 'Play on a command Claude wrote runs it in the Terminal, and "done" tells Claude what it printed', async () => {
        // 1.0.136. A build without it has no `play` in its test API: SKIP, not FAIL.
        if ((await page.evaluate('typeof window.__mdTest?.play')) !== 'function') return { status: 'SKIP', evidence: ['this build has no Play buttons (a build before 1.0.136)'] }
        await activate(claude.id)
        // A number nobody can guess: Claude can only answer it from what the terminal printed.
        // Windows' own sessions run PowerShell; Ubuntu's (and a Mac's, when the suite runs there) a POSIX shell.
        const [lang, command] = place !== 'ubuntu' && process.platform === 'win32'
          ? ['powershell', 'Get-Random -Minimum 100000000 -Maximum 999999999']
          : ['bash', 'od -An -N4 -tu4 /dev/urandom']
        await typeInTerminal(page, claude.id, `Reply with only a ${lang} code block containing exactly this command and nothing else: ${command}`)
        const commands = await waitFor(async () => {
          const c = (await callTestApi(page, 'readings'))?.commands?.[claude.id]
          return Array.isArray(c) && c.some((b) => b.text === command) ? c : null
        }, { timeoutMs, intervalMs: 1000, what: 'the reply to carry the command' })
        const evidence = [`the turn's commands: ${commands.map((b) => `${b.lang}: ${b.text}`).join('; ')}`]
        await waitFor(async () => (await exists(page, { css: '[data-testid="command-play"]' })) || null, { timeoutMs: 30_000, what: 'the Play button beside the command' })
        const shot = path.join(out, `play-${place}.png`)
        fs.writeFileSync(shot, await screenshot(page))
        evidence.push(`screenshot ${path.basename(shot)}`)
        await click(page, { css: '[data-testid="command-play"]' })
        const pid = `${claude.id}-partner`
        const printed = await waitFor(async () => {
          const m = (await terminalText(page, pid, 40)).match(/^\s*(\d{6,})\s*$/m)
          return m ? m[1] : null
        }, { timeoutMs: 60_000, intervalMs: 1000, what: 'the Terminal to print the number' })
        evidence.push(`Play ran it in the Terminal, which printed ${printed}`)
        // The note on this message is the only way Claude can know the number.
        await click(page, { css: `[data-terminal-id="${claude.id}"]` }).catch(() => {})
        await turn(claude.id, 'done. What number did the terminal print? Reply with only the number.', printed)
        evidence.push(`asked after "done", Claude replied ${printed}`)
        if (await exists(page, { css: 'button[aria-label="Hide Terminal"]' })) await click(page, { css: 'button[aria-label="Hide Terminal"]' })
        return { evidence }
      })

      await run('crew-watch', 'A message scheduled for later puts the session On watch, on the deck and on the Crew with its clock', async () => {
        await activate(claude.id)
        await tabMenuItem(claude.id, 'Schedule a message…')
        await setValue(page, { css: 'input[maxlength]' }, '/rename md-suite never sent')
        const later = new Date(Date.now() + 60 * 60 * 1000)
        const p2 = (n) => String(n).padStart(2, '0')
        if (await exists(page, { css: 'input[type="datetime-local"]' })) {
          await setValue(page, { css: 'input[type="datetime-local"]' }, `${later.getFullYear()}-${p2(later.getMonth() + 1)}-${p2(later.getDate())}T${p2(later.getHours())}:${p2(later.getMinutes())}`)
        }
        await click(page, { text: 'Schedule', exact: true })
        const evidence = []
        const thread = await waitFor(async () => {
          const ts = await callTestApi(page, 'crewThreads')
          const t = Array.isArray(ts) ? ts.find((x) => x.sessionId === claude.id) : null
          return t && t.deckStatus === 'watching' && t.behaviour === 'watching' ? t : null
        }, { timeoutMs: 30_000, what: 'the deck and the Crew both to say On watch' })
        evidence.push(`deck ${thread.deckStatus}, Crew behaviour ${thread.behaviour}`)
        if (await exists(page, { css: 'button[aria-label="Crew"]' })) {
          await click(page, { css: 'button[aria-label="Crew"]' })
          // 1.0.124: the clock badge (8) was drawn from outside its atlas, so it never showed.
          const fig = await waitFor(async () => {
            const as = await callTestApi(page, 'crewAgents')
            const a = Array.isArray(as) ? as.find((x) => x.id === thread.id) : null
            return a && a.status === 'watching' && a.state === 'at-site' && a.badge === 8 ? a : null
          }, { timeoutMs: 60_000, what: 'the figure to stand at its building with the clock badge' })
          evidence.push(`figure ${fig.status}, ${fig.state}, badge ${fig.badge}`)
          const shot = path.join(out, `crew-watch-${place}.png`)
          fs.writeFileSync(shot, await screenshot(page))
          evidence.push(`screenshot ${path.basename(shot)}`)
          await toChat()
        } else evidence.push('no Crew button in this build: figure not checked')
        await activate(claude.id)
        await click(page, { text: 'Cancel', exact: true })
        await waitFor(async () => {
          const ts = await callTestApi(page, 'crewThreads')
          const t = Array.isArray(ts) ? ts.find((x) => x.sessionId === claude.id) : null
          return t && t.deckStatus !== 'watching'
        }, { timeoutMs: 30_000, what: 'the session to leave On watch once the message is cancelled' })
        evidence.push('cancelled: no longer On watch (the Crew was visited, so the archive below also covers 1.0.110)')
        return { evidence }
      })

      await run('rename-claude', 'Rename a Claude session from the sidebar', async () => {
        const label = `md-suite ${place} claude renamed ${stamp}`
        await renameViaSidebar(claude.id, label)
        state.claude.label = label
        saveState()
        const evidence = [`label is now "${label}" (the cloud title on claude.ai is on the human list)`]
        // 1.0.153: a sidebar rename is sent to Claude as /rename (until then it never was, and the
        // transcript's older title took the label back). Claude says so when it applies it.
        const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        await waitForTerminal(page, claude.id, new RegExp(`Session renamed to:\\s*${esc}`), { timeoutMs: 90_000, what: `Claude to apply /rename ${label}` })
          .then(() => evidence.push('Claude applied it: "Session renamed to: ' + label + '"'))
          .catch(() => { throw failWith('the sidebar name never reached Claude (no "Session renamed to" within 90 s)', evidence) })
        await labelSurvives(claude.id, label, 'the rename', evidence)
        return { evidence }
      })

      await run('restart', 'Restart: a new terminal, the same conversation', async () => {
        await activate(claude.id)
        const before = await sessionById(claude.id)
        await click(page, { css: 'button[title="Restart session"]' })
        await waitFor(async () => (await sessionById(claude.id))?.createdAt !== before.createdAt, { timeoutMs: 20_000, what: 'the session to be remounted' })
        await activate(claude.id)
        await waitClaudeReady(claude.id)
        await waitFor(async () => countAnswers(await terminalText(page, claude.id), state.marker) > 0, { timeoutMs: 60_000, what: `the earlier reply ${state.marker} to come back from the transcript` })
        const conv = await conversationOf(claude.id)
        const evidence = [`remounted (createdAt ${before.createdAt} -> ${(await sessionById(claude.id)).createdAt})`, `the reply ${state.marker} is back`, `conversation ${conv ?? 'unknown'} (was ${state.conversation ?? 'unknown'})`]
        if (state.conversation && conv && conv !== state.conversation) throw failWith('a different conversation after Restart', evidence)
        await labelSurvives(claude.id, state.claude.label, 'Restart', evidence)
        return { evidence }
      })

      await run('archive-claude', 'Archive, then Restore from the sidebar: the same conversation', async () => {
        const back = await archiveAndRestore(claude.id)
        await waitClaudeReady(claude.id)
        await waitFor(async () => countAnswers(await terminalText(page, claude.id), state.marker) > 0, { timeoutMs: 60_000, what: `the earlier reply ${state.marker} after Restore` })
        const conv = await conversationOf(claude.id)
        const evidence = [`restored ${back.id} "${back.label}"`, `the reply ${state.marker} is back`, `conversation ${conv ?? 'unknown'} (was ${state.conversation ?? 'unknown'})`]
        if (state.conversation && conv && conv !== state.conversation) throw failWith('a different conversation after Restore', evidence)
        await labelSurvives(claude.id, state.claude.label, 'Archive and Restore', evidence)
        return { evidence }
      })
    }
  }
} else if (phase === 'resume') {
  if (!state.shell && !state.claude) {
    record(out, { id: `${P}.relaunch`, title: 'Sessions come back after a relaunch', status: 'FAIL', evidence: [`no ${path.basename(statePath)} from the main phase`] })
    page.close()
    process.exit(1)
  }
  await run('relaunch', 'Sessions come back after quitting and starting again', async () => {
    await toChat()
    // Restored sessions arrive through the restore offer, as after any restart.
    if (await exists(page, { text: 'Resume', exact: true })) await click(page, { text: 'Resume', exact: true })
    const want = [state.shell, state.claude].filter(Boolean)
    const got = await waitFor(async () => {
      const all = await sessions()
      return want.every((w) => all.some((s) => s.id === w.id)) ? all : null
    }, { timeoutMs: 30_000, what: 'every session from before the relaunch' })
    const evidence = want.map((w) => { const s = got.find((x) => x.id === w.id); return `${w.id}: "${s.label}"${s.label === w.label ? '' : ` (expected "${w.label}")`}` })
    if (want.some((w) => got.find((x) => x.id === w.id).label !== w.label)) throw failWith('a label did not survive', evidence)
    return { evidence }
  })
  if (state.claude) {
    await run('resume', 'The Claude session continues the same conversation', async () => {
      await activate(state.claude.id)
      await waitClaudeReady(state.claude.id)
      const seen = await turn(state.claude.id, 'What single word did you reply with earlier in this conversation? Reply with only that word.', state.marker)
      const conv = await conversationOf(state.claude.id)
      const evidence = [`asked for the word: replied ${state.marker}`, `statuses seen: ${seen.join(' > ')}`, `conversation ${conv ?? 'unknown'} (was ${state.conversation ?? 'unknown'})`]
      if (state.conversation && conv && conv !== state.conversation) throw failWith('a different conversation after the relaunch', evidence)
      return { evidence }
    })
  }
} else {
  console.error(`unknown --phase ${phase}`)
  process.exit(2)
}

page.close()
process.exit(failed ? 1 : 0)
