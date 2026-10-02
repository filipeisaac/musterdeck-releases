#!/usr/bin/env node
/**
 * run-suite.mjs -- run every read-only check against the app under test and record each
 * verdict (WSL parity P9). The list is `lib/checks.mjs`.
 *
 *   node suite/run-suite.mjs --port 9339 --out <dir> [--wsl] [--environment wsl:Ubuntu]
 *        [--project <a folder on this machine>] [--codex-run] [--insights-run] [--only id,id]
 *
 * `--wsl` passes `--require-wsl` to every check that takes it, so "nothing Ubuntu to check"
 * is a FAIL rather than a quiet PASS: use it once an Ubuntu Claude session has had a turn.
 * `--codex-run` adds codex.mjs --run (one read-only Codex PTY in the distro; skipped by the
 * script itself when the distro has no Codex). `--insights-run` adds insights.mjs --run in
 * `--environment`: minutes long, and it spends the account's tokens, so only on purpose.
 *
 * Each check's first output line is its verdict (PASS / FAIL / SKIP), the rest its evidence;
 * a check that prints neither is judged by its exit code. Exit 1 when any check failed.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { portFromArgs } from './lib/cdp.mjs'
import { outDirFromArgs, record } from './lib/results.mjs'
import { CHECKS } from './lib/checks.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const port = portFromArgs()
const out = outDirFromArgs()
const opts = {
  wsl: argv.includes('--wsl'),
  project: arg('--project'),
  environment: arg('--environment'),
  codexRun: argv.includes('--codex-run'),
  insightsRun: argv.includes('--insights-run'),
}
const only = arg('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null

function runOne(check) {
  const args = [path.join(here, check.script), '--port', String(port)]
  if (opts.wsl && check.wsl) args.push('--require-wsl')
  for (const a of check.extra ?? []) args.push(a.replace('{project}', opts.project ?? '').replace('{environment}', opts.environment ?? ''))
  return new Promise((resolve) => {
    const t0 = Date.now()
    const child = spawn(process.execPath, args, { env: process.env, windowsHide: true })
    let stdout = '', stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    const timer = setTimeout(() => child.kill(), check.timeoutMs ?? 180_000)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr, ms: Date.now() - t0, args })
    })
  })
}

let failed = 0
for (const check of CHECKS) {
  if (only && !only.includes(check.id)) continue
  const id = `check.${check.id}`
  const title = `${check.script}${check.extra ? ` ${check.extra.join(' ')}` : ''} (${check.phase})`
  if (check.when && !opts[check.when]) continue
  if (check.when === 'insightsRun' && !opts.environment) {
    record(out, { id, title, status: 'SKIP', evidence: ['--insights-run needs --environment wsl:<distro>'] })
    continue
  }
  const r = await runOne(check)
  const lines = `${r.stdout}\n${r.stderr}`.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)
  const verdict = lines.find((l) => /^(PASS|FAIL|SKIP)\b/.test(l))
  let status = verdict ? verdict.split(/\s/)[0] : r.code === 0 ? 'PASS' : 'FAIL'
  if (status === 'PASS' && r.code !== 0) status = 'FAIL'
  if (status === 'FAIL') failed++
  const evidence = [(verdict ?? lines[0] ?? `exit ${r.code}`).replace(/^(PASS|FAIL|SKIP)\s+/, ''), ...lines.filter((l) => l !== verdict).slice(0, 12), `node ${r.args.slice(1).map((a) => path.basename(a) === check.script ? check.script : a).join(' ')} (exit ${r.code}, ${Math.round(r.ms / 1000)}s)`]
  record(out, { id, title, status, evidence, ms: r.ms })
}
process.exit(failed ? 1 : 0)
