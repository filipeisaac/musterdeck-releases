/**
 * results.mjs -- one place every suite driver writes its verdicts, so `report.mjs` can turn a
 * whole run into findings.md without anybody copying lines by hand.
 *
 * A result is one JSON line in `<out>/results.jsonl`:
 *   { id, title, status: 'PASS' | 'FAIL' | 'SKIP' | 'INFO', evidence: string[], ms, at }
 * `id` is stable (`lifecycle.ubuntu.turn`, `check.logs`), so a run that is repeated replaces
 * the earlier line for the same id when the report is built (the last one wins).
 */
import fs from 'node:fs'
import path from 'node:path'

export const STATUSES = ['PASS', 'FAIL', 'SKIP', 'INFO']

/** `--out <dir>` from argv, created if missing, or null when not given. */
export function outDirFromArgs(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--out')
  if (i < 0 || !argv[i + 1]) return null
  const dir = path.resolve(argv[i + 1])
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Append one result; also print it as `STATUS id: first evidence line`. */
export function record(out, { id, title, status, evidence = [], ms = 0 }) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status ${status} for ${id}`)
  const lines = (Array.isArray(evidence) ? evidence : [evidence]).map((l) => String(l)).filter((l) => l.length > 0)
  const entry = { id, title: title ?? id, status, evidence: lines, ms, at: new Date().toISOString() }
  if (out) fs.appendFileSync(path.join(out, 'results.jsonl'), `${JSON.stringify(entry)}\n`)
  const head = lines[0] ? `: ${lines[0]}` : ''
  console.log(`${status} ${id}${head}`)
  return entry
}

/** Every result in a run, the last line per id winning, in first-seen order. */
export function readResults(out) {
  const file = path.join(out, 'results.jsonl')
  if (!fs.existsSync(file)) return []
  const byId = new Map()
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      if (byId.has(r.id)) byId.delete(r.id)
      byId.set(r.id, r)
    } catch { /* a torn line from a killed run: skip it */ }
  }
  return [...byId.values()]
}

/**
 * Run one step and record it: `fn` returns `{ status?, evidence }` (status defaults to PASS) or
 * throws, which records a FAIL with the error. Never throws itself, so a run goes on past a
 * failure and every later step still gets its answer.
 */
export async function step(out, id, title, fn) {
  const t0 = Date.now()
  try {
    const r = (await fn()) ?? {}
    return record(out, { id, title, status: r.status ?? 'PASS', evidence: r.evidence ?? [], ms: Date.now() - t0 })
  } catch (err) {
    const msg = String(err?.message ?? err)
    return record(out, { id, title, status: 'FAIL', evidence: [msg, ...(err?.evidence ?? [])], ms: Date.now() - t0 })
  }
}

/** An error that carries evidence lines into the FAIL. */
export function failWith(message, evidence = []) {
  const e = new Error(message)
  e.evidence = evidence
  return e
}
