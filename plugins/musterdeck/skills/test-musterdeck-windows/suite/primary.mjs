#!/usr/bin/env node
/**
 * primary.mjs -- sessions MusterDeck makes on its own follow the Primary environment (WSL parity P8).
 *
 *   node suite/primary.mjs --port 9339 [--project <windows folder>] [--require-wsl] [--json]
 *
 * Through `window.__mdTest.primaryRouting(project)`, a DRY RUN of the decision Ask MusterDeck,
 * a new Crew theme's session, the add-account default and a project from this machine use
 * (nothing is staged or created), checked against the rule:
 *  - no WSL environment: all four on this machine;
 *  - a staged workspace (Ask, theme, add account): the Ubuntu environment when the Primary is
 *    Ubuntu, or when Windows has no Claude; this machine otherwise;
 *  - a project from this machine: Ubuntu only when Windows has no Claude;
 *  - whatever goes to Ubuntu carries a Linux folder under the mount root (`/mnt/...`), and on
 *    Windows the help folder's mount path names the same folder (`wslpath -w` agrees).
 * `--require-wsl` fails when no WSL environment exists. Exit 0 with one line on pass, 1 with
 * the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const pi = argv.indexOf('--project')
const project = pi >= 0 ? argv[pi + 1] : undefined

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
/** The Windows path the distro gives for a Linux path. */
function windowsPathOf(distro, linux) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: `wslpath -w ${q(linux)} 2>/dev/null\n`, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  return (r.stdout ?? '').trim() || null
}
const norm = (p) => String(p ?? '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()

try {
  const page = await connectToApp(port)
  const r = await callTestApi(page, 'primaryRouting', project)
  page.close()
  if (!r) {
    console.error('FAIL primary: primaryRouting() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  if (asJson) console.log(JSON.stringify(r, null, 2))
  const problems = []
  const wsl = r.environments.filter((e) => e.kind === 'wsl')
  if (requireWsl && wsl.length === 0) problems.push('no WSL environment is set up')
  const primary = r.environments.find((e) => e.isPrimary)
  const primaryWsl = primary?.kind === 'wsl'
  const noNative = r.nativeClaude === 'missing'
  const target = wsl.find((e) => e.isPrimary) ?? wsl.find((e) => e.claudePath) ?? wsl[0]

  const expectWsl = { ask: wsl.length > 0 && (primaryWsl || noNative), theme: wsl.length > 0 && (primaryWsl || noNative), addAccount: wsl.length > 0 && (primaryWsl || noNative), project: wsl.length > 0 && noNative }
  for (const k of ['ask', 'theme', 'addAccount', 'project']) {
    const t = r[k]
    if (!t) { problems.push(`${k}: no answer`); continue }
    const unreachable = /unreachable$/.test(t.reason)
    const want = expectWsl[k] && !unreachable ? target.id : null
    if (t.environmentId !== want) problems.push(`${k}: runs in ${t.environmentId ?? 'this machine'} (${t.reason}), expected ${want ?? 'this machine'}`)
    if (t.environmentId && t.path !== null && !String(t.path).startsWith('/')) problems.push(`${k}: Ubuntu folder ${t.path} is not a Linux path`)
    if (t.refused && !(unreachable && noNative)) problems.push(`${k}: refused (${t.refused}) though something can run it`)
    if (t.refused && /\u2014/.test(t.refused)) problems.push(`${k}: the refusal has an em dash`)
  }
  if (process.platform === 'win32' && r.ask?.environmentId && r.ask.path) {
    const back = windowsPathOf(r.ask.environmentId.slice(4), r.ask.path)
    if (!back) problems.push(`ask: ${r.ask.path} could not be turned back into a Windows path`)
  }

  if (problems.length) {
    console.error(`FAIL primary: ${problems.join('; ')}`)
    process.exit(1)
  }
  const where = (t) => `${t.environmentId ?? 'here'}`
  console.log(wsl.length
    ? `PASS primary: Primary ${primary?.id ?? 'none'}, Windows Claude ${r.nativeClaude}; Ask ${where(r.ask)}, theme ${where(r.theme)}, add account ${where(r.addAccount)}, project ${where(r.project)}`
    : `PASS primary: nothing to check (no WSL environment); all four on this machine`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
