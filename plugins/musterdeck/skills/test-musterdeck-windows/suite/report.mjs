#!/usr/bin/env node
/**
 * report.mjs -- turn a run's results into findings.md, and record the tester's answers
 * (WSL parity P9).
 *
 *   node suite/report.mjs --out <dir> [--build <tag>] [--run parity]      write findings.md
 *   node suite/report.mjs --out <dir> --set <id> --status PASS|FAIL|SKIP|INFO --note "<what they saw>"
 *
 * findings.md: the summary table (every automated check, then every human one), the machine,
 * each check's evidence lines exactly as recorded, the human checks with what was asked and
 * what was seen, and the screenshots and logs in the folder. A human check never answered is
 * listed as "not done", never as a pass.
 */
import fs from 'node:fs'
import path from 'node:path'
import { outDirFromArgs, readResults, record, STATUSES } from './lib/results.mjs'
import { HUMAN } from './lib/human.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
if (!out) { console.error('--out <dir> is required'); process.exit(2) }

const set = arg('--set')
if (set) {
  const status = String(arg('--status') ?? '').toUpperCase()
  if (!STATUSES.includes(status)) { console.error(`--status must be one of ${STATUSES.join(', ')}`); process.exit(2) }
  const id = set.startsWith('human.') || set.includes('.') ? set : `human.${set}`
  const h = HUMAN.find((x) => `human.${x.id}` === id)
  record(out, { id, title: h?.title ?? id, status, evidence: [arg('--note') ?? ''] })
  process.exit(0)
}

const clean = (s) => String(s).replace(/\u2014/g, '-')
const results = readResults(out)
const auto = results.filter((r) => !r.id.startsWith('human.'))
const human = HUMAN.map((h) => ({ h, r: results.find((r) => r.id === `human.${h.id}`) ?? null }))
const count = (st) => auto.filter((r) => r.status === st).length
const machine = fs.existsSync(path.join(out, 'machine.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'machine.json'), 'utf8')) : null
const files = fs.readdirSync(out)
const pngs = files.filter((f) => f.endsWith('.png')).sort()
const logs = files.filter((f) => /\.(txt|log|json)$/.test(f) && !['machine.json', 'fixtures.json'].includes(f) && !f.startsWith('lifecycle-')).sort()

const L = []
L.push(`# MusterDeck WSL ${arg('--run', 'parity')} run, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
L.push('')
L.push(`Build: ${arg('--build', 'unknown')}.${machine ? ` Machine: ${machine.platform === 'win32' ? `Windows build ${machine.windowsBuild}` : `${machine.platform} ${machine.release}`}, WSL ${machine.wslVersion ?? '-'}, distro ${machine.distro ?? '-'}, suite Node ${machine.node}${machine.electron ? ' (MusterDeck as Node)' : ''}.` : ''}`)
L.push('')
L.push('## Summary')
L.push('')
L.push(`Automated: ${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped, ${count('INFO')} for information. Human: ${human.filter((x) => x.r).length} of ${human.length} answered.`)
L.push('')
L.push('| # | Check | Result | One line |')
L.push('|---|---|---|---|')
let n = 0
for (const r of auto) L.push(`| ${++n} | ${clean(r.title)} | ${r.status} | ${clean(r.evidence[0] ?? '').replace(/\|/g, '/').slice(0, 160)} |`)
for (const { h, r } of human) L.push(`| ${++n} | ${clean(h.title)} (human) | ${r?.status ?? 'not done'} | ${clean(r?.evidence[0] ?? '').replace(/\|/g, '/').slice(0, 160)} |`)
L.push('')
if (machine) {
  L.push('## Machine')
  L.push('')
  L.push('```json')
  L.push(JSON.stringify(machine, null, 2))
  L.push('```')
  L.push('')
}
L.push('## Automated checks')
L.push('')
for (const r of auto) {
  L.push(`### ${r.id}: ${clean(r.title)}`)
  L.push('')
  L.push(`Result: **${r.status}** (${Math.round((r.ms ?? 0) / 1000)}s, ${r.at})`)
  L.push('')
  if (r.evidence.length) {
    L.push('```')
    for (const e of r.evidence) L.push(clean(e))
    L.push('```')
    L.push('')
  }
}
L.push('## Human checks')
L.push('')
for (const { h, r } of human) {
  L.push(`### human.${h.id}: ${clean(h.title)}`)
  L.push('')
  L.push(`- What to do: ${clean(h.do)}`)
  L.push(`- What to look for: ${clean(h.look)}`)
  L.push(`- Result: **${r?.status ?? 'not done'}**${r?.evidence[0] ? `. ${clean(r.evidence[0])}` : ''}`)
  L.push('')
}
L.push('## Screenshots')
L.push('')
L.push(pngs.length ? pngs.map((f) => `- ${f}`).join('\n') : '- none')
L.push('')
L.push('## Logs')
L.push('')
L.push(logs.length ? logs.map((f) => `- ${f}`).join('\n') : '- none')
L.push('')

fs.writeFileSync(path.join(out, 'findings.md'), `${L.join('\n')}\n`)
console.log(`findings.md: ${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped; human ${human.filter((x) => x.r).length}/${human.length}`)
