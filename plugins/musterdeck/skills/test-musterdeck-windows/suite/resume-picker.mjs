#!/usr/bin/env node
/**
 * resume-picker.mjs -- does the New Session dialog's Resume tab list an Ubuntu environment's
 * conversations from the DISTRO? (WSL parity P3.)
 *
 *   node suite/resume-picker.mjs --port 9339 [--env wsl:Ubuntu] [--folder /home/you/app] [--require-wsl] [--json]
 *
 * For each WSL environment (or `--env`), asks `window.__mdTest.resumeConversations(folder, env)`,
 * which is the dialog picker's own call (`discovery:sessions` with the environment). The
 * folder is `--folder`, else every folder an Ubuntu Claude session of that environment works
 * in, else `~`. Passes when at least one folder lists a conversation and every one listed
 * carries a transcript under the distro's `~/.claude/projects` (a Linux path, which is what an
 * Ubuntu resume launches with), never a `C:\` path. Opening the list may start the distro
 * (the dialog does the same). `--require-wsl` fails when there is no WSL environment.
 * Exit 0 with one line on pass, 1 with the reasons.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const onlyEnv = flag('--env')
const onlyFolder = flag('--folder')

try {
  const page = await connectToApp(port)
  const envs = ((await callTestApi(page, 'environments'))?.environments ?? []).filter((e) => e.kind === 'wsl' && (!onlyEnv || e.id === onlyEnv))
  const sessions = await callTestApi(page, 'sessions')
  const results = []
  for (const env of envs) {
    const folders = onlyFolder ? [onlyFolder] : [...new Set((sessions ?? [])
      .filter((s) => s.environmentId === env.id && !s.shellOnly && s.workingDirectory)
      .map((s) => s.workingDirectory))]
    if (folders.length === 0) folders.push('~')
    for (const folder of folders) {
      results.push({ env: env.id, folder, list: await callTestApi(page, 'resumeConversations', folder, env.id) })
    }
  }
  page.close()
  if (asJson) console.log(JSON.stringify(results, null, 2))

  const problems = []
  if (envs.length === 0 && (requireWsl || onlyEnv)) problems.push(onlyEnv ? `no environment ${onlyEnv}` : 'no WSL environment')
  for (const r of results) {
    if (!Array.isArray(r.list)) { problems.push(`${r.env} ${r.folder}: resumeConversations() answered nothing (older build, or not in test mode?)`); continue }
    const bad = r.list.filter((c) => typeof c.transcriptPath !== 'string' || !c.transcriptPath.startsWith('/') || !c.transcriptPath.includes('/.claude/projects/'))
    if (bad.length) problems.push(`${r.env} ${r.folder}: ${bad.length} conversation(s) without a Linux transcript path (${bad[0].transcriptPath})`)
  }
  for (const env of envs) {
    const listed = results.filter((r) => r.env === env.id).reduce((n, r) => n + (Array.isArray(r.list) ? r.list.length : 0), 0)
    if (listed === 0) problems.push(`${env.id}: no conversation listed in ${results.filter((r) => r.env === env.id).map((r) => r.folder).join(', ')} (has a session there had a turn?)`)
  }
  if (problems.length) {
    console.error(`FAIL resume-picker: ${problems.join('; ')}`)
    process.exit(1)
  }
  const parts = results.map((r) => `${r.env} ${r.folder}=${r.list.length}`)
  console.log(`PASS resume-picker: ${parts.length ? parts.join(', ') : 'no WSL environment (nothing to check)'}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
