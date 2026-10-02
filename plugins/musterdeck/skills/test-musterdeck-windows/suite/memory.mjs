#!/usr/bin/env node
/**
 * memory.mjs -- does the Memory page list a running distro's memory files? (WSL parity P4.)
 *
 *   node suite/memory.mjs --port 9339 [--require-wsl] [--require-files] [--json]
 *
 * Reads `window.__mdTest.claudeHomes()` (which environments run) and `memory()` (what the page
 * scans), then for every RUNNING WSL environment:
 *  - each memory file tagged with it sits under that environment's `~/.claude\projects` share
 *    path and in a `<project>\memory\` folder, and its project is tagged the same;
 *  - one of them reads back through the page's own read (`memoryRead`, validated in main);
 * and for a STOPPED one, that nothing of it is listed (the page never boots a distro).
 * A distro may simply have no memory yet: `--require-files` fails then, `--require-wsl` fails
 * when no WSL environment runs. Exit 0 with one line on pass, 1 with the reasons.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const requireFiles = argv.includes('--require-files')

try {
  const page = await connectToApp(port)
  const homes = await callTestApi(page, 'claudeHomes')
  const mem = await callTestApi(page, 'memory')
  const problems = []
  if (!mem) problems.push('memory() answered nothing (older build, or not in test mode?)')
  const wsl = (homes?.homes ?? []).filter((h) => h.kind === 'wsl')
  const running = wsl.filter((h) => h.running === true)
  if (requireWsl && running.length === 0) problems.push('no running WSL environment to check')

  const parts = []
  for (const h of wsl) {
    const files = (mem?.files ?? []).filter((f) => f.environmentId === h.envId)
    const projects = (mem?.projects ?? []).filter((p) => p.environmentId === h.envId)
    if (h.running !== true) {
      if (files.length) problems.push(`${h.envId}: stopped, yet ${files.length} of its files were listed`)
      continue
    }
    const root = `${h.claude.host}\\projects\\`.toLowerCase()
    for (const f of files) {
      const p = String(f.path ?? '').toLowerCase()
      if (!p.startsWith(root) || !p.includes('\\memory\\')) problems.push(`${h.envId}: ${f.path} is not under ${root}<project>\\memory\\`)
      if (!projects.some((pr) => pr.projectDir === f.projectDir)) problems.push(`${h.envId}: ${f.filename}'s project ${f.projectDir} is not listed as ${h.envId}'s`)
    }
    if (files.length === 0 && requireFiles) problems.push(`${h.envId}: running, but no memory file listed`)
    if (files.length) {
      const back = await callTestApi(page, 'memoryRead', files[0].path)
      if (!back?.ok) problems.push(`${h.envId}: ${files[0].path} did not read back: ${back?.error ?? 'no answer'}`)
    }
    parts.push(`${h.envId}=${projects.length} projects, ${files.length} files`)
  }
  page.close()
  if (asJson) console.log(JSON.stringify({ homes: homes?.homes ?? [], memory: mem }, null, 2))

  if (problems.length) {
    console.error(`FAIL memory: ${problems.join('; ')}`)
    process.exit(1)
  }
  const native = (mem?.files ?? []).filter((f) => !f.environmentId).length
  console.log(`PASS memory: ${parts.length ? parts.join(', ') : 'no WSL environment (nothing to check)'}; this machine ${native} files`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
