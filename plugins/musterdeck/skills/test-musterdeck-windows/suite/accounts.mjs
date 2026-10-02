#!/usr/bin/env node
/**
 * accounts.mjs -- several accounts per environment (WSL parity P8). Identity METADATA only:
 * nothing here reads a credentials file or a token.
 *
 *   node suite/accounts.mjs --port 9339 [--require-wsl] [--switch <sessionId>] [--json]
 *
 * Through `window.__mdTest.accounts(true)` and `accountSwitchPlan(...)`:
 *  - accounts are listed per environment: this machine's carry no environment, each WSL
 *    environment's carry its id, and no session is offered an account from another environment;
 *  - every finished Ubuntu account (its distro running) is who `claude auth status` says, run
 *    in the distro with its `CLAUDE_CONFIG_DIR` (the distro's own login with none): the app asks
 *    through its own path, and on Windows this script asks again independently through
 *    `wsl.exe`, and both must name the recorded address;
 *  - an added account's config dir is `~/.musterdeck/profiles/<id>/.claude`;
 *  - the switch flow, as a DRY RUN: for an Ubuntu Claude session (`--switch <id>`, else the
 *    first one with a choice), switching to another of its environment's accounts would respawn
 *    it with that account in the same environment, resuming its conversation when it has a
 *    pointer; an account from elsewhere is not offered. Nothing is switched.
 * `--require-wsl` fails when no WSL environment has an account recorded. Exit 0 with one line
 * on pass, 1 with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const si = argv.indexOf('--switch')
const switchId = si >= 0 ? argv[si + 1] : undefined

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
const canon = (e) => String(e ?? '').trim().toLowerCase()

/** `claude auth status` in the distro, under a config dir (null: the distro's own login). The email only. */
function askDistro(env, configDir) {
  const head = env.loginPath ? `PATH=${q(env.loginPath)}; export PATH\n` : ''
  const run = configDir ? `CLAUDE_CONFIG_DIR=${q(configDir)} ${q(env.claudePath)} auth status` : `env -u CLAUDE_CONFIG_DIR ${q(env.claudePath)} auth status`
  const r = spawnSync('wsl.exe', ['-d', env.distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: `${head}${run} 2>/dev/null\n`, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 90_000, windowsHide: true,
  })
  try {
    const j = JSON.parse((r.stdout ?? '').trim())
    return j.loggedIn === true && typeof j.email === 'string' ? j.email : null
  } catch { return null }
}

try {
  const page = await connectToApp(port)
  const v = await callTestApi(page, 'accounts', true)
  if (!v) {
    page.close()
    console.error('FAIL accounts: accounts() answered nothing (older build, or not in test mode?)')
    process.exit(1)
  }
  const problems = []
  const envs = v.main.environments
  const withAccounts = envs.filter((e) => e.profiles.length > 0)
  if (requireWsl && withAccounts.length === 0) problems.push('no WSL environment has an account recorded (check Ubuntu once in Settings, Environments, signed in)')

  for (const n of v.main.native) if (n.environmentId) problems.push(`${n.id}: listed as this machine's, but tagged ${n.environmentId}`)
  const envOf = new Map()
  for (const e of envs) {
    if (e.profiles.filter((p) => p.isPrimary).length > 1) problems.push(`${e.id}: more than one primary`)
    for (const p of e.profiles) {
      envOf.set(p.id, e.id)
      if (p.pendingSignIn) continue
      if (!p.isPrimary && p.configDir && !/\/\.musterdeck\/profiles\/[a-z0-9-]+\/\.claude$/.test(p.configDir)) problems.push(`${p.id}: config dir ${p.configDir}`)
      if (e.running !== true) continue
      if (p.identity === null || p.identity === undefined) { problems.push(`${p.id} (${e.id}): claude auth status says nobody is signed in there`); continue }
      if (canon(p.identity.email) !== canon(p.accountEmail)) problems.push(`${p.id} (${e.id}): recorded ${p.accountEmail}, the distro says ${p.identity.email}`)
      if (process.platform === 'win32' && e.claudePath) {
        const said = askDistro(e, p.isPrimary ? null : p.configDir)
        if (canon(said) !== canon(p.accountEmail)) problems.push(`${p.id} (${e.id}): recorded ${p.accountEmail}, wsl.exe auth status says ${said ?? 'nobody'}`)
      }
    }
  }

  // No session is offered an account from another environment.
  for (const s of v.sessions) {
    for (const id of s.offered) {
      const at = envOf.get(id) ?? null
      const want = s.host === 'wsl' ? s.environmentId : null
      if (at !== want) problems.push(`${s.id} (${s.host}): offered ${id}, which belongs to ${at ?? 'this machine'}`)
    }
  }

  // The switch, dry.
  let switchNote = 'no Ubuntu session with a choice of account'
  const candidate = switchId ? v.sessions.find((s) => s.id === switchId) : v.sessions.find((s) => s.host === 'wsl' && s.provider === 'claude' && !s.shellOnly && s.offered.length >= 2)
  if (switchId && !candidate) problems.push(`--switch ${switchId}: no such session`)
  if (candidate) {
    const target = candidate.offered.find((id) => id !== candidate.profileId)
    const plan = target ? await callTestApi(page, 'accountSwitchPlan', candidate.id, target) : null
    if (!plan) problems.push(`${candidate.id}: no switch plan`)
    else {
      if (!plan.decision.ok) problems.push(`${candidate.id}: switching to ${target} would not happen (${plan.decision.reason})`)
      if (!plan.offered) problems.push(`${candidate.id}: ${target} is not offered`)
      if (plan.respawn && plan.respawn.environmentId !== candidate.environmentId) problems.push(`${candidate.id}: the respawn would run in ${plan.respawn.environmentId}`)
      if (plan.respawn && plan.respawn.profileId !== target) problems.push(`${candidate.id}: the respawn would carry ${plan.respawn.profileId}`)
      const foreign = [...envOf.keys()].find((id) => envOf.get(id) !== candidate.environmentId) ?? v.main.native[0]?.id
      if (foreign) {
        const other = await callTestApi(page, 'accountSwitchPlan', candidate.id, foreign)
        if (other?.offered) problems.push(`${candidate.id}: offered ${foreign} from another environment`)
      }
      switchNote = `switch ${candidate.id} -> ${target} would respawn in ${plan.respawn?.environmentId ?? '?'}${plan.respawn?.resume ? ' resuming its conversation' : ' (no pointer yet: a fresh conversation)'}`
    }
  }
  page.close()
  if (asJson) console.log(JSON.stringify(v, null, 2))

  if (problems.length) {
    console.error(`FAIL accounts: ${problems.join('; ')}`)
    process.exit(1)
  }
  const per = envs.map((e) => `${e.id} ${e.profiles.filter((p) => !p.pendingSignIn).length} account(s)${e.running === true ? '' : ' (not running: identity not asked)'}`).join(', ')
  console.log(envs.length
    ? `PASS accounts: ${v.main.native.length} on this machine; ${per}; ${switchNote}`
    : `PASS accounts: nothing to check (no WSL environment); ${v.main.native.length} on this machine, ${v.sessions.length} session(s) offered only this machine's`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
