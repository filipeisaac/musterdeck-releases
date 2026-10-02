#!/usr/bin/env node
/**
 * distro-home.mjs -- does the app name every environment's Claude home, and can it read a
 * running distro's? (WSL parity P2.)
 *
 *   node suite/distro-home.mjs --port 9339 [--json] [--require-wsl]
 *
 * Reads `window.__mdTest.claudeHomes()` (main's `wsl/claude-homes.ts` plus one stat through
 * `wsl/distro-files.ts`) and checks it against `environments()` (the probe answers):
 *
 * - the native environment has a home, and its `~/.claude` was looked at;
 * - every WSL environment with a probe `home` has `linux` = `<home>/.claude` and
 *   `<home>/.codex`, reached through `\\wsl.localhost\<distro>\...` (or a drive path for a
 *   home under the mount root);
 * - a RUNNING distro's `~/.claude` was found (the reader works end to end); a stopped one
 *   was NOT touched (`claudeExists: null`);
 * - with `--require-wsl`, at least one WSL environment is resolved (on Larissa's machine).
 *
 * Exit 0 with one line on pass, 1 with the reasons.
 */
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const asJson = process.argv.includes('--json')
const requireWsl = process.argv.includes('--require-wsl')

const strip = (p) => p.replace(/\/+$/, '')

try {
  const page = await connectToApp(port)
  const report = await callTestApi(page, 'claudeHomes')
  const envs = await callTestApi(page, 'environments')
  page.close()
  if (asJson) console.log(JSON.stringify({ report, environments: envs?.environments ?? [] }, null, 2))

  const problems = []
  if (!report || !Array.isArray(report.homes)) {
    console.error('claudeHomes() answered nothing: is this build older than P2, or not in test mode?')
    process.exit(1)
  }
  const byId = new Map(report.homes.map((h) => [h.envId, h]))
  const native = report.homes.find((h) => h.kind === 'native')
  if (!native) problems.push('no native home')
  else if (!/[\\/]\.claude$/.test(native.claude?.host ?? '')) problems.push(`native claude home looks wrong: ${native.claude?.host}`)
  else if (typeof native.claudeExists !== 'boolean') problems.push('native ~/.claude was not looked at')

  let wslResolved = 0
  for (const env of envs?.environments ?? []) {
    if (env.kind !== 'wsl') continue
    const home = env.probe?.home
    const h = byId.get(env.id)
    if (!home) {
      if (h) problems.push(`${env.id}: a home with no probe answer (guessed?)`)
      continue
    }
    if (!h) { problems.push(`${env.id}: probe says home ${home}, but no Claude home was named`); continue }
    wslResolved++
    if (h.claude?.linux !== `${strip(home)}/.claude`) problems.push(`${env.id}: claude.linux ${h.claude?.linux} != ${strip(home)}/.claude`)
    if (h.codex?.linux !== `${strip(home)}/.codex`) problems.push(`${env.id}: codex.linux ${h.codex?.linux} != ${strip(home)}/.codex`)
    const share = `\\\\wsl.localhost\\${env.distro}\\`
    if (!(h.claude?.host ?? '').toLowerCase().startsWith(share.toLowerCase()) && !/^[A-Za-z]:\\/.test(h.claude?.host ?? '')) {
      problems.push(`${env.id}: claude.host ${h.claude?.host} is neither under ${share} nor a drive path`)
    }
    if (h.running === true && h.claudeExists !== true) problems.push(`${env.id}: running, but ~/.claude was ${h.claudeExists === false ? 'not found' : 'not readable'} through the distro reader`)
    if (h.running !== true && h.claudeExists !== null) problems.push(`${env.id}: not running, yet the reader touched it`)
  }
  if (requireWsl && wslResolved === 0) problems.push(`no WSL environment resolved (unresolved: ${JSON.stringify(report.unresolved)})`)

  if (problems.length) {
    console.error(`FAIL distro-home: ${problems.join('; ')}`)
    process.exit(1)
  }
  const parts = report.homes.map((h) => `${h.envId}=${h.claude.linux ?? h.claude.host}${h.kind === 'wsl' ? ` (${h.running ? 'running' : 'stopped'})` : ''}`)
  const un = report.unresolved?.length ? `; unresolved ${report.unresolved.map((u) => `${u.envId}:${u.reason}`).join(',')}` : ''
  console.log(`PASS distro-home: ${parts.join(', ')}${un}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
