/**
 * ui.mjs -- drive MusterDeck's window the way a person does: find a control by what it says,
 * click it, type into it, right-click it. For the suite's DRIVERS (lifecycle, environment
 * setup, quitting); the checks only READ through `window.__mdTest`.
 *
 * A control is found by a spec, evaluated in the page:
 *   { css, text, exact, startsWith, within, nth, last, visible }   a button (or `css`) whose
 *                                                             aria-label, text or title matches `text`
 *   { near: 'Label', within }                                the input under a <label> that says so
 *   { checkboxText: 'Shell only', within }                   the checkbox inside a label that says so
 * `within` is a CSS selector for the region to search (a dialog, the sidebar).
 */
import { callTestApi } from './cdp.mjs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Poll until `fn` answers something truthy; throw `what` on timeout. */
export async function waitFor(fn, { timeoutMs = 30_000, intervalMs = 500, what = 'the condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  let last
  for (;;) {
    try {
      last = await fn()
      if (last) return last
    } catch (err) {
      last = err
    }
    if (Date.now() > deadline) {
      const why = last instanceof Error ? ` (${last.message})` : ''
      throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}${why}`)
    }
    await sleep(intervalMs)
  }
}

const HELPERS = String.raw`(() => {
  if (window.__mdSuite) return true
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
  const nameOf = (el) => norm(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.value)
  const shown = (el) => !!(el.offsetParent || el.getClientRects().length)
  const matches = (el, spec) => {
    if (spec.text === undefined) return true
    const n = nameOf(el)
    if (spec.exact) return n === spec.text
    if (spec.startsWith) return n.startsWith(spec.text)
    return n.includes(spec.text)
  }
  function find(spec) {
    const roots = spec.within ? Array.from(document.querySelectorAll(spec.within)) : [document]
    for (const root of roots) {
      if (spec.near) {
        const label = Array.from(root.querySelectorAll('label')).find((l) => norm(l.textContent) === spec.near || norm(l.textContent).startsWith(spec.near))
        const input = label && label.parentElement && label.parentElement.querySelector('input, textarea, select')
        if (input) return input
        continue
      }
      if (spec.checkboxText) {
        const label = Array.from(root.querySelectorAll('label')).find((l) => norm(l.textContent).startsWith(spec.checkboxText))
        const box = label && label.querySelector('input[type=checkbox]')
        if (box) return box
        continue
      }
      const els = Array.from(root.querySelectorAll(spec.css || 'button'))
        .filter((el) => (spec.visible === false || shown(el)) && matches(el, spec))
      const el = spec.last ? els[els.length - 1] : els[spec.nth || 0]
      if (el) return el
    }
    return null
  }
  const setters = {
    INPUT: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set,
    TEXTAREA: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set,
    SELECT: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set,
  }
  window.__mdSuite = {
    exists: (spec) => !!find(spec),
    text: (spec) => { const el = find(spec); return el ? nameOf(el) : null },
    value: (spec) => { const el = find(spec); return el ? el.value : null },
    click: (spec) => { const el = find(spec); if (!el) return false; el.scrollIntoView({ block: 'nearest' }); el.click(); return true },
    contextMenu: (spec) => {
      const el = find(spec); if (!el) return false
      el.scrollIntoView({ block: 'nearest' })
      const r = el.getBoundingClientRect()
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + Math.min(20, r.width / 2), clientY: r.top + r.height / 2, button: 2 }))
      return true
    },
    setValue: (spec, value) => {
      const el = find(spec); if (!el) return false
      el.focus()
      ;(setters[el.tagName] || setters.INPUT).call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    key: (spec, key) => {
      const el = find(spec); if (!el) return false
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      return true
    },
    check: (spec, want) => {
      const el = find(spec); if (!el) return false
      if (el.checked !== want) el.click()
      return true
    },
    rect: (spec) => { const el = find(spec); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } },
  }
  return true
})()`

async function helper(page, name, ...args) {
  await page.evaluate(HELPERS)
  return page.evaluate(`window.__mdSuite.${name}(${args.map((a) => JSON.stringify(a)).join(', ')})`)
}

export const exists = (page, spec) => helper(page, 'exists', spec)
export const textOf = (page, spec) => helper(page, 'text', spec)
export const valueOf = (page, spec) => helper(page, 'value', spec)
export const rectOf = (page, spec) => helper(page, 'rect', spec)

function describe(spec) {
  return spec.near ? `the field labelled "${spec.near}"` : spec.checkboxText ? `the "${spec.checkboxText}" checkbox` : `"${spec.text ?? spec.css}"${spec.within ? ` in ${spec.within}` : ''}`
}

/** Click a control, waiting up to `timeoutMs` for it to appear. */
export async function click(page, spec, { timeoutMs = 10_000 } = {}) {
  await waitFor(() => helper(page, 'click', spec), { timeoutMs, intervalMs: 250, what: describe(spec) })
}
export async function contextMenu(page, spec, { timeoutMs = 10_000 } = {}) {
  await waitFor(() => helper(page, 'contextMenu', spec), { timeoutMs, intervalMs: 250, what: describe(spec) })
}
export async function setValue(page, spec, value, { timeoutMs = 10_000 } = {}) {
  await waitFor(() => helper(page, 'setValue', spec, value), { timeoutMs, intervalMs: 250, what: describe(spec) })
}
export async function pressKey(page, spec, key, { timeoutMs = 10_000 } = {}) {
  await waitFor(() => helper(page, 'key', spec, key), { timeoutMs, intervalMs: 250, what: describe(spec) })
}
export async function setChecked(page, spec, want, { timeoutMs = 10_000 } = {}) {
  await waitFor(() => helper(page, 'check', spec, want), { timeoutMs, intervalMs: 250, what: describe(spec) })
}

/** The last `lines` lines a terminal shows (`__mdTest.readTerminal`), '' when it has none yet. */
export async function terminalText(page, ptyId, lines = 1000) {
  return (await callTestApi(page, 'readTerminal', ptyId, lines)) ?? ''
}

/**
 * Type into a terminal through its xterm, as a keyboard would: focus the terminal's input,
 * insert the text, then a separate Enter a beat later (the same two-part write MusterDeck's
 * own `/rename` uses: text, a pause, a bare carriage return). Answers how it was typed.
 */
export async function typeInTerminal(page, ptyId, text, { enter = true } = {}) {
  const sel = JSON.stringify(`[data-terminal-id="${ptyId}"] textarea`)
  const focused = await page.evaluate(`(() => { const t = document.querySelector(${sel}); if (!t) return false; t.focus(); return document.activeElement === t })()`)
  if (!focused) throw new Error(`no terminal input for ${ptyId} (is its tab showing?)`)
  if (text) await page.send('Input.insertText', { text })
  if (enter) {
    await sleep(150)
    // One keyDown carrying the text, as Puppeteer sends Enter: Chromium raises keypress only
    // when keydown was not cancelled, and xterm cancels it, so this is exactly one Enter.
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  }
  return 'keyboard'
}

/** Wait until a terminal's text matches `re`; answers the matching text. */
export async function waitForTerminal(page, ptyId, re, { timeoutMs = 60_000, lines = 1000, what } = {}) {
  return waitFor(async () => {
    const t = await terminalText(page, ptyId, lines)
    return re.test(t) ? t : null
  }, { timeoutMs, what: what ?? `${re} in ${ptyId}` })
}

/** A full-window screenshot of the page as PNG bytes (Chromium's own capture, not the screen). */
export async function screenshot(page) {
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  return Buffer.from(r.data, 'base64')
}
