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
 *   colour     TERM and COLORTERM in it, then truecolour blocks, read back from a screenshot of
 *              the window (pixels counted near the exact colours sent); the PNG is kept
 *   drop       what dropping `--drop` on it would type (the drop handler, dry run)
 *   rename     Rename from the sidebar menu: the label changes
 *   split      Split right from the tab menu, both terminals still alive, then Merge panes
 *   archive    Archive from the tab menu, Restore from the sidebar: the same session, a live shell
 *   With `--claude` (spends a few cheap turns on the account):
 *   claude     a Claude session with a Partner Terminal, ready (a folder trust question, if
 *              Claude asks one, is answered Yes)
 *   turn       one prompt with a marker word: Working is seen on the deck, then it settles,
 *              and the reply is the marker
 *   scheduled  "Schedule a message..." from the tab menu, due now: a `/rename` (a local command,
 *              no tokens) is typed in, and the label follows it
 *   partner    the Partner Terminal opens in the session's folder (`pwd`)
 *   rename     as above, for the Claude session
 *   restart    Restart on the status strip: a new terminal, the same conversation (the marker
 *              comes back from the transcript, the conversation id is unchanged)
 *   archive    Archive from the tab menu, then Restore from the sidebar's Archived Sessions:
 *              the same session id and conversation
 *   The ids, the marker and the conversation are saved in `<out>/lifecycle-<place>.json`.
 *
 * Phase `resume`, after the app was quit (quit-app.mjs) and started again with the same data
 * folder: the sessions are back with their labels, and the Claude session continues the SAME
 * conversation: its id is unchanged and, asked, it answers the marker again.
 *
 * Every step records PASS, FAIL or SKIP with evidence lines (lib/results.mjs). Exit 1 when
 * any step failed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, step, record, failWith } from './lib/results.mjs'
import {
  click, contextMenu, setValue, pressKey, setChecked, exists, sleep, waitFor,
  terminalText, typeInTerminal, waitForTerminal, screenshot,
} from './lib/ui.mjs'
import { decodePng, countNear } from './lib/png.mjs'

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

const CLAUDE_READY = /\? for shortcuts|bypass permissions|accept edits|plan mode on|Try "|─{20,}[\s\S]{0,8}>/
const TRUST = /Do you trust the files|trust this folder|Yes, proceed|Is this a project you/i

/** Wait for Claude's prompt in a terminal; answers a folder trust question Yes if one shows. */
async function waitClaudeReady(ptyId) {
  let trusted = false
  return waitFor(async () => {
    const t = await terminalText(page, ptyId)
    if (!trusted && TRUST.test(t) && !CLAUDE_READY.test(t)) {
      trusted = true
      await typeInTerminal(page, ptyId, '', { enter: true })
      return null
    }
    return CLAUDE_READY.test(t) ? { text: t, trusted } : null
  }, { timeoutMs, intervalMs: 1000, what: `Claude's prompt in ${ptyId}` })
}

/** A line that is the marker alone (Claude's reply), possibly behind its bullet. */
const answerRe = (marker) => new RegExp(`^[^A-Za-z0-9]{0,4}${marker}[.!]?\\s*$`, 'gm')
const countAnswers = (text, marker) => (text.match(answerRe(marker)) ?? []).length

/** The conversation a Claude session is on: the reading's uuid, else its resume pointer. */
async function conversationOf(id) {
  const tk = await callTestApi(page, 'tokenomics', 5).catch(() => null)
  return tk?.open?.find((o) => o.id === id)?.uuid ?? (await sessionById(id))?.resumeUuid ?? null
}

/** Type a prompt and watch the deck until the turn is over. Answers the statuses seen. */
async function turn(id, prompt, marker) {
  const before = countAnswers(await terminalText(page, id), marker)
  await typeInTerminal(page, id, prompt)
  const seen = []
  await waitFor(async () => {
    const st = (await callTestApi(page, 'readings'))?.status?.[id] ?? 'none'
    if (seen[seen.length - 1] !== st) seen.push(st)
    const n = countAnswers(await terminalText(page, id), marker)
    return n > before && st !== 'working' && st !== 'spawning' ? true : null
  }, { timeoutMs, intervalMs: 400, what: `the reply ${marker} and the turn to settle` })
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

/** Archive from the tab menu, then Restore from the sidebar's Archived Sessions. Answers the record. */
async function archiveAndRestore(id) {
  await activate(id)
  await contextMenu(page, { css: `[data-session-id="${id}"]` })
  await click(page, { text: 'Archive session', exact: true })
  await waitFor(async () => !(await sessionById(id)), { timeoutMs: 20_000, what: 'the session to leave Active Sessions' })
  await toChat()
  if (!(await exists(page, { text: 'Restore', exact: true }))) await click(page, { text: 'Archived Sessions', startsWith: true })
  await click(page, { text: 'Restore', exact: true }, { timeoutMs: 15_000 })
  const back = await waitFor(() => sessionById(id), { timeoutMs: 20_000, what: 'the session to come back with its id' })
  await activate(id)
  return back
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
  if (!termOk || !drawn) {
    throw failWith(!termOk ? `expected TERM=xterm-256color COLORTERM=truecolor, got "${line}"` : 'the truecolour blocks are not in the screenshot at their exact colours', evidence)
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
    await typeInTerminal(page, shell.id, echo(`md-suite-alive-${stamp}`))
    await waitForTerminal(page, shell.id, new RegExp(`^md-suite-alive-${stamp}\\s*$`, 'm'), { timeoutMs: 30_000 })
    return { evidence: [`session ${shell.id} host ${shell.host}${shell.environmentId ? ` ${shell.environmentId}` : ''} in ${shell.workingDirectory}`, `first output: ${t.trim().split('\n').pop()}`] }
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
      await contextMenu(page, { css: `[data-session-id="${shell.id}"]` })
      await click(page, { text: 'Split right', exact: true })
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
      return { evidence: [`session ${claude.id} host ${claude.host}${claude.environmentId ? ` ${claude.environmentId}` : ''}`, r.trusted ? 'answered the folder trust question Yes' : 'no trust question'] }
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
        const name = `md-suite-sched-${stamp}`
        await contextMenu(page, { css: `[data-session-id="${claude.id}"]` })
        await click(page, { text: 'Schedule a message…', exact: true })
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
        await click(page, { css: 'button[aria-label="Switch back to Claude"]' })
        return { evidence: [`pwd in ${pid}: ${line}`] }
      })

      await run('rename-claude', 'Rename a Claude session from the sidebar', async () => {
        const label = `md-suite ${place} claude renamed ${stamp}`
        await renameViaSidebar(claude.id, label)
        state.claude.label = label
        saveState()
        return { evidence: [`label is now "${label}" (the cloud title on claude.ai is on the human list)`] }
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
        return { evidence }
      })

      await run('archive-claude', 'Archive, then Restore from the sidebar: the same conversation', async () => {
        const back = await archiveAndRestore(claude.id)
        await waitClaudeReady(claude.id)
        await waitFor(async () => countAnswers(await terminalText(page, claude.id), state.marker) > 0, { timeoutMs: 60_000, what: `the earlier reply ${state.marker} after Restore` })
        const conv = await conversationOf(claude.id)
        const evidence = [`restored ${back.id} "${back.label}"`, `the reply ${state.marker} is back`, `conversation ${conv ?? 'unknown'} (was ${state.conversation ?? 'unknown'})`]
        if (state.conversation && conv && conv !== state.conversation) throw failWith('a different conversation after Restore', evidence)
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
