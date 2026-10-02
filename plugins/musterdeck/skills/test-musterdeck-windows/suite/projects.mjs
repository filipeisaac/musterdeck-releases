#!/usr/bin/env node
/**
 * projects.mjs -- do the ProjectBrowser and the Crew's dormant plots include a distro's projects?
 * (WSL parity P4.)
 *
 *   node suite/projects.mjs --port 9339 [--require-wsl] [--json]
 *
 * Reads `window.__mdTest.projects()`: what `discovery:projects` lists (the ProjectBrowser) and the
 * plots the Crew would draw with "Show projects with no open session" on. Checks:
 *  - every open Ubuntu Claude session's folder is listed as a project OF ITS ENVIRONMENT (the
 *    distro's `~/.claude/projects` was read; run after the session has had a turn);
 *  - no plot is drawn for a folder an Ubuntu session has open in that same environment;
 *  - every WSL plot carries its environment, so Open starts the session there.
 * (Whether a stopped distro is left untouched is the unit tests' to hold: from outside, a list
 * answered from earlier this run looks the same as one read just now.)
 * `--require-wsl` fails when there is no Ubuntu session to check. Exit 0 with one line on pass,
 * 1 with the reasons.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const mangle = (p) => String(p ?? '').replace(/[^A-Za-z0-9]/g, '-')

try {
  const page = await connectToApp(port)
  const sessions = await callTestApi(page, 'sessions')
  const got = await callTestApi(page, 'projects')
  page.close()
  if (asJson) console.log(JSON.stringify(got, null, 2))
  if (!got) {
    console.error('FAIL projects: projects() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  const problems = []
  const ubuntu = (sessions ?? []).filter((s) => s.host === 'wsl' && !s.shellOnly && (s.provider ?? 'claude') === 'claude' && s.workingDirectory)
  if (requireWsl && ubuntu.length === 0) problems.push('no Ubuntu Claude session with a folder to check')

  for (const s of ubuntu) {
    const listed = got.projects.some((p) => p.environmentId === s.environmentId && mangle(p.path) === mangle(s.workingDirectory))
    if (!listed) problems.push(`${s.label}: ${s.workingDirectory} is not listed as a project of ${s.environmentId} (has it had a turn? is the distro running?)`)
    const plot = (got.plots ?? []).find((t) => t.environmentId === s.environmentId && mangle(t.cwd) === mangle(s.workingDirectory))
    if (plot) problems.push(`${s.label}: a dormant plot is drawn for ${s.workingDirectory}, which is open`)
  }
  if (got.plots === null) problems.push('the Crew scan failed')
  for (const t of got.plots ?? []) {
    if (String(t.id).startsWith('project:wsl:') && !String(t.environmentId ?? '').startsWith('wsl:')) problems.push(`plot ${t.id} lost its environment`)
  }
  const wslProjects = got.projects.filter((p) => String(p.environmentId ?? '').startsWith('wsl:'))
  const wslPlots = (got.plots ?? []).filter((t) => String(t.environmentId ?? '').startsWith('wsl:'))

  if (problems.length) {
    console.error(`FAIL projects: ${problems.join('; ')}`)
    process.exit(1)
  }
  const tail = ubuntu.length ? `${ubuntu.length} Ubuntu session(s) checked` : 'no Ubuntu session (nothing to check)'
  console.log(`PASS projects: ${tail}; ${wslProjects.length} Ubuntu project(s) listed, ${wslPlots.length} Ubuntu plot(s); this machine ${got.projects.length - wslProjects.length}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
