#!/usr/bin/env node
/**
 * skills.mjs -- does an Ubuntu session list its DISTRO's skills and commands, and are the app's
 * bundled skills installed there? (WSL parity P5.)
 *
 *   node suite/skills.mjs --port 9339 [--require-wsl] [--json]
 *
 * For every RUNNING WSL environment (`claudeHomes()`), and every folder an Ubuntu session of it
 * has open (or none: user and plugin entries only):
 *  - the picker's catalogue (`skills(cwd, environmentId)`, the same `discovery:skills` /
 *    `discovery:commands` calls the hotbar and the Crew `/` menu make) equals what `wsl.exe`
 *    lists in the distro: `<cwd>/.claude/skills/<name>/SKILL.md`, `~/.claude/skills/...`, the
 *    `.md` files under the two `commands/` folders, and the same under each plugin's
 *    `installPath` from the distro's own `installed_plugins.json`, with the native rules
 *    (project shadows user, plugins namespaced, nested commands as `a:b`);
 *  - when an Ubuntu Claude session launched this run (`distroSkills().firstWrite`): the backup
 *    exists (`~/.musterdeck/claude-config-backups/initial.tar`), and every bundled skill is in
 *    `~/.claude/skills/<name>/` with a `.ccc-bundled` stamp, unless the app reported it as left
 *    to a plugin or to the user's own copy.
 * Off Windows there is no `wsl.exe` and nothing WSL to check. Exit 0 with one line on pass, 1
 * with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** Run a script in the distro; stdout as text, or null when it could not run. */
function inDistro(distro, script) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: script, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  return r.status === 0 ? r.stdout : null
}

/** `find -L <dir> -name '*.md'`, relative, sorted, one per line, between markers. */
function listMd(dir, tag) {
  return `echo 'BEGIN ${tag}'; if [ -d ${q(dir)} ]; then (cd ${q(dir)} && find -L . -mindepth 1 -maxdepth 4 -name '*.md' -type f 2>/dev/null | sed 's#^\\./##' | sort); fi; echo 'END ${tag}'`
}

function blocks(text) {
  const out = {}
  let cur = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const b = /^BEGIN (\S+)$/.exec(line)
    const e = /^END (\S+)$/.exec(line)
    if (b) { cur = b[1]; out[cur] = []; continue }
    if (e) { cur = null; continue }
    if (cur && line) out[cur].push(line)
  }
  return out
}

/** The catalogue the native rules give for what the distro has. */
function expected(home, cwd, distro) {
  const claude = `${home.replace(/\/+$/, '')}/.claude`
  const project = cwd && cwd.startsWith('/') ? `${cwd.replace(/\/+$/, '')}/.claude` : null
  const pluginsJson = inDistro(distro, `cat ${q(`${claude}/plugins/installed_plugins.json`)} 2>/dev/null; true`) ?? ''
  let plugins = []
  try {
    for (const [key, entries] of Object.entries(JSON.parse(pluginsJson).plugins ?? {})) {
      const list = Array.isArray(entries) ? entries : [entries]
      const p = list.find((x) => typeof x?.installPath === 'string')?.installPath
      if (key.split('@')[0] && p && p.startsWith('/')) plugins.push({ plugin: key.split('@')[0], path: p })
    }
  } catch { plugins = [] }
  const parts = [
    ...(project ? [listMd(`${project}/skills`, 'ps'), listMd(`${project}/commands`, 'pc')] : []),
    listMd(`${claude}/skills`, 'us'), listMd(`${claude}/commands`, 'uc'),
    ...plugins.flatMap((p, i) => [listMd(`${p.path}/skills`, `xs${i}`), listMd(`${p.path}/commands`, `xc${i}`)]),
  ]
  const b = blocks(inDistro(distro, parts.join('\n')))
  const skillNames = (rows) => (rows ?? []).map((r) => /^([^/]+)\/SKILL\.md$/.exec(r)?.[1]).filter(Boolean)
  const cmdNames = (rows) => (rows ?? []).map((r) => r.replace(/\.md$/i, '').split('/').filter(Boolean).join(':')).filter(Boolean)
  const skills = new Set()
  const commands = new Set()
  for (const n of skillNames(b.ps)) skills.add(n)
  for (const n of skillNames(b.us)) skills.add(n)
  for (const n of cmdNames(b.pc)) commands.add(n)
  for (const n of cmdNames(b.uc)) commands.add(n)
  plugins.forEach((p, i) => {
    for (const n of skillNames(b[`xs${i}`])) skills.add(`${p.plugin}:${n}`)
    for (const n of cmdNames(b[`xc${i}`])) commands.add(`${p.plugin}:${n}`)
  })
  return { skills, commands }
}

function diff(label, want, got, problems) {
  const missing = [...want].filter((x) => !got.has(x))
  const extra = [...got].filter((x) => !want.has(x))
  if (missing.length) problems.push(`${label}: not listed ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''}`)
  if (extra.length) problems.push(`${label}: listed but not in the distro ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ', ...' : ''}`)
}

try {
  const page = await connectToApp(port)
  const homes = await callTestApi(page, 'claudeHomes')
  const sessions = (await callTestApi(page, 'sessions')) ?? []
  const ds = await callTestApi(page, 'distroSkills')
  const problems = []
  const parts = []
  const running = (homes?.homes ?? []).filter((h) => h.kind === 'wsl' && h.running === true)
  if (requireWsl && running.length === 0) problems.push('no running WSL environment to check')
  if (running.length && process.platform !== 'win32') problems.push('a running WSL environment, but this is not Windows')
  const report = []

  for (const h of process.platform === 'win32' ? running : []) {
    const home = h.home?.linux
    if (!home) { problems.push(`${h.envId}: no Linux home`); continue }
    const cwds = [...new Set(sessions.filter((s) => s.host === 'wsl' && s.environmentId === h.envId).map((s) => s.workingDirectory).filter(Boolean))]
    for (const cwd of cwds.length ? cwds : [undefined]) {
      const got = await callTestApi(page, 'skills', cwd, h.envId)
      if (!got) { problems.push(`${h.envId}: skills() answered nothing`); continue }
      const want = expected(home, cwd, h.distro)
      const label = `${h.envId}${cwd ? ` ${cwd}` : ''}`
      diff(`${label} skills`, want.skills, new Set(got.skills.map((s) => s.command)), problems)
      diff(`${label} commands`, want.commands, new Set(got.commands.map((c) => c.command)), problems)
      report.push({ envId: h.envId, cwd: cwd ?? null, skills: got.skills.length, commands: got.commands.length })
      parts.push(`${label}: ${got.skills.length} skills, ${got.commands.length} commands`)
    }

    const fw = (ds?.firstWrite ?? []).find((o) => String(o.distro).toLowerCase() === String(h.distro).toLowerCase())
    if (!fw) { parts.push(`${h.envId}: no Ubuntu Claude launch this run, bundled skills not checked`); continue }
    if (fw.backup === 'failed') problems.push(`${h.envId}: the backup of ~/.claude failed`)
    const claude = `${home.replace(/\/+$/, '')}/.claude`
    const checks = [
      `[ -f ${q(`${home.replace(/\/+$/, '')}/.musterdeck/claude-config-backups/initial.tar`)} ] && echo 'HAS backup'`,
      ...(ds?.bundled ?? []).map((b) => `[ -f ${q(`${claude}/skills/${b.name}/SKILL.md`)} ] && echo 'HAS ${b.name}'; [ -f ${q(`${claude}/skills/${b.name}/.ccc-bundled`)} ] && echo 'STAMP ${b.name}'`),
    ]
    const out = inDistro(h.distro, checks.join('\n') + '\ntrue') ?? ''
    if (fw.backup !== 'failed' && !out.includes('HAS backup')) problems.push(`${h.envId}: no backup at ~/.musterdeck/claude-config-backups/initial.tar`)
    for (const b of ds?.bundled ?? []) {
      const action = (fw.skills ?? []).find((s) => s.name === b.name)?.action
      if (action === 'provided-by-plugin' || action === 'kept-user-copy') continue
      if (!out.includes(`HAS ${b.name}`)) problems.push(`${h.envId}: bundled skill ${b.name} is not in ~/.claude/skills (${action ?? 'not attempted'})`)
      else if (!out.includes(`STAMP ${b.name}`)) problems.push(`${h.envId}: bundled skill ${b.name} has no stamp`)
    }
    parts.push(`${h.envId}: backup ${fw.backup}, bundled ${(fw.skills ?? []).map((s) => `${s.name}=${s.action}`).join(' ') || 'none'}`)
  }
  page.close()
  if (asJson) console.log(JSON.stringify({ homes: homes?.homes ?? [], report, distroSkills: ds }, null, 2))

  if (problems.length) {
    console.error(`FAIL skills: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log(`PASS skills: ${parts.length ? parts.join('; ') : 'no running WSL environment (nothing to check)'}; ${(ds?.bundled ?? []).length} bundled skills shipped`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
