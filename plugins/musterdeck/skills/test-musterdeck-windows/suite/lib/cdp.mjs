/**
 * cdp.mjs -- the smallest Chrome DevTools Protocol client the WSL suite needs.
 *
 * No dependencies: Node 22+ has `fetch` and `WebSocket` built in, so a script copied out of
 * the repo (P9 ships these inside the test skill) runs on a tester's machine with nothing but
 * Node. It talks to a MusterDeck started with `MUSTERDECK_TEST_CDP=<port>`, which binds
 * Chromium's debugging port to 127.0.0.1 and exposes the read-only `window.__mdTest`
 * (`src/renderer/test-mode.ts`).
 */

export const DEFAULT_PORT = 9339

/** The port from `--port <n>`, else `MUSTERDECK_TEST_CDP`, else the default. */
export function portFromArgs(argv = process.argv.slice(2), env = process.env) {
  const i = argv.indexOf('--port')
  const raw = i >= 0 ? argv[i + 1] : env.MUSTERDECK_TEST_CDP
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_PORT
}

/** Wait until the debugging endpoint answers (the app may still be starting). */
export async function waitForEndpoint(port, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return await r.json()
    } catch (err) {
      lastErr = err
    }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error(`Nothing answered on 127.0.0.1:${port} (is MusterDeck running with MUSTERDECK_TEST_CDP=${port}?) ${lastErr?.message ?? ''}`)
}

/** One open CDP session on a page target. */
export class CdpPage {
  constructor(ws, target) {
    this.ws = ws
    this.target = target
    this.nextId = 1
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'))
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
  }

  static async open(target) {
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error(`Could not open ${target.url}`)), { once: true })
    })
    return new CdpPage(ws, target)
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`))
      }, 15_000)
    })
  }

  /** Evaluate an expression in the page and return its value (JSON-serialisable). */
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value
  }

  close() {
    try { this.ws.close() } catch { /* already closed */ }
  }
}

/**
 * The MusterDeck window: the page target whose `window.__mdTest` exists. Waits for it, since
 * the API is installed a moment after the page loads.
 */
export async function connectToApp(port, { timeoutMs = 30_000 } = {}) {
  await waitForEndpoint(port, { timeoutMs })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    for (const t of targets.filter((x) => x.type === 'page' && x.webSocketDebuggerUrl)) {
      let page = null
      try {
        page = await CdpPage.open(t)
        if (await page.evaluate('typeof window.__mdTest === "object" && window.__mdTest !== null')) return page
      } catch { /* not this one */ }
      page?.close()
    }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error(`No MusterDeck window with window.__mdTest on 127.0.0.1:${port}. Was it started with MUSTERDECK_TEST_CDP?`)
}

/** Call one `window.__mdTest` getter by name with JSON arguments. */
export function callTestApi(page, name, ...args) {
  const argList = args.map((a) => JSON.stringify(a)).join(', ')
  return page.evaluate(`window.__mdTest.${name}(${argList})`)
}
