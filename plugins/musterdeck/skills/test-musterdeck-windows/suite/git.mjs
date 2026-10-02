#!/usr/bin/env node
/**
 * git.mjs -- does the GitHub panel read an Ubuntu session's repo IN its distro? (WSL parity P6.)
 *
 *   node suite/git.mjs --port 9339 [--require-wsl] [--json]
 *
 * For every open session with a folder, `window.__mdTest.localGit(id)` (the Local Git section's
 * own `github:localgit:get` call, and the auto-detect banner's `github:repo:detect`) must equal
 * what git itself says about that folder:
 *  - an Ubuntu session: the same five commands run with `git -C <folder>` through `wsl.exe -d
 *    <distro>` (branch, ahead/behind, staged, unstaged, untracked, stash count, the last five
 *    commits), and the detected repo equals the `origin` remote's `owner/repo`;
 *  - a session on this machine: the same, with this machine's git (so the check runs, and holds
 *    native behaviour, on any machine).
 * SSH sessions are skipped (their git is on the remote). Run with nothing changing in those
 * folders. `--require-wsl` fails when there is no Ubuntu session with a folder. Exit 0 with one
 * line on pass, 1 with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')

/** The commands the panel runs, in its order (`LOCAL_GIT_COMMANDS`). */
const COMMANDS = [
  ['rev-parse', '--abbrev-ref', 'HEAD'],
  ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
  ['status', '--porcelain'],
  ['stash', 'list'],
  ['log', '-5', '--format=%H|%s|%ct'],
  ['remote', 'get-url', 'origin'],
]

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** Each command's { code, stdout } in the distro, one `wsl.exe` for all of them. */
function inDistro(distro, cwd) {
  const script = COMMANDS.map((args, i) =>
    `git -C ${q(cwd)} ${args.map(q).join(' ')} >/tmp/md-suite-git.$$ 2>/dev/null; echo "X${i} $?"; echo 'BEGIN ${i}'; base64 -w0 </tmp/md-suite-git.$$; echo; echo 'END ${i}'`,
  ).join('\n') + '\nrm -f /tmp/md-suite-git.$$\n'
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: script, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true,
  })
  const text = String(r.stdout ?? '')
  return COMMANDS.map((_a, i) => {
    const code = Number(new RegExp(`^X${i} (\\d+)\\r?$`, 'm').exec(text)?.[1] ?? NaN)
    const b64 = new RegExp(`^BEGIN ${i}\\r?\\n([^\\n]*)\\r?\\nEND ${i}`, 'm').exec(text)?.[1] ?? ''
    return { code, stdout: Buffer.from(b64.trim(), 'base64').toString('utf8') }
  })
}

/** The same, with this machine's git. */
function here(cwd) {
  return COMMANDS.map((args) => {
    const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 30_000, windowsHide: true })
    return { code: r.status ?? NaN, stdout: String(r.stdout ?? '') }
  })
}

/** The panel's reading of those answers (`readLocalGitState`), and the repo the banner offers. */
function expected(res) {
  const empty = { ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], stashCount: 0, recentCommits: [] }
  const ok = (i) => res[i].code === 0
  const slugOf = (url) => {
    const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?\s*$/i.exec(url)
    return m ? `${m[1]}/${m[2]}` : null
  }
  const slug = ok(5) ? slugOf(res[5].stdout) : null
  if (!ok(0) || !ok(2)) return { state: empty, slug }
  const [ahead, behind] = ok(1) ? res[1].stdout.trim().split(/\s+/).map((n) => Number(n) || 0) : [0, 0]
  const staged = []
  const unstaged = []
  const untracked = []
  for (const line of res[2].stdout.split('\n')) {
    if (!line) continue
    const prefix = line.slice(0, 2)
    const file = line.slice(3)
    if (prefix === '??') untracked.push(file)
    else {
      if (prefix[0] !== ' ' && prefix[0] !== '?') staged.push(file)
      if (prefix[1] !== ' ' && prefix[1] !== '?') unstaged.push(file)
    }
  }
  const stash = ok(3) ? res[3].stdout.trim() : ''
  const recentCommits = ok(4)
    ? res[4].stdout.trim().split('\n').filter(Boolean).map((l) => {
      const [sha, subject, ct] = l.split('|')
      return { sha: sha.slice(0, 7), subject, at: Number(ct) * 1000 }
    })
    : []
  return {
    state: { branch: res[0].stdout.trim(), ahead: ahead ?? 0, behind: behind ?? 0, staged, unstaged, untracked, stashCount: stash ? stash.split('\n').length : 0, recentCommits },
    slug,
  }
}

const norm = (s) => JSON.stringify({
  branch: s?.branch ?? null, ahead: s?.ahead ?? 0, behind: s?.behind ?? 0,
  staged: [...(s?.staged ?? [])].sort(), unstaged: [...(s?.unstaged ?? [])].sort(), untracked: [...(s?.untracked ?? [])].sort(),
  stashCount: s?.stashCount ?? 0, recentCommits: (s?.recentCommits ?? []).map((c) => c.sha),
})

try {
  const page = await connectToApp(port)
  const sessions = (await callTestApi(page, 'sessions')) ?? []
  const problems = []
  const parts = []
  const report = []
  const ubuntu = sessions.filter((s) => s.host === 'wsl' && s.workingDirectory)
  const native = sessions.filter((s) => s.host === 'native' && s.workingDirectory)
  if (requireWsl && ubuntu.length === 0) problems.push('no Ubuntu session with a folder to check')
  if (ubuntu.length && process.platform !== 'win32') problems.push('an Ubuntu session, but this is not Windows')

  for (const s of [...(process.platform === 'win32' ? ubuntu : []), ...native]) {
    const got = await callTestApi(page, 'localGit', s.id)
    if (!got) { problems.push(`${s.label ?? s.id}: localGit() answered nothing`); continue }
    if (!got.state?.ok) { problems.push(`${s.label ?? s.id}: the panel's call failed (${got.state?.error ?? 'no answer'})`); continue }
    const distro = s.host === 'wsl' ? String(s.environmentId).slice('wsl:'.length) : null
    const want = expected(distro ? inDistro(distro, s.workingDirectory) : here(s.workingDirectory))
    const label = `${s.label ?? s.id}${distro ? ` (${distro})` : ''}`
    if (norm(got.state.state) !== norm(want.state)) problems.push(`${label}: panel ${norm(got.state.state)} but git says ${norm(want.state)}`)
    if ((got.slug ?? null) !== want.slug) problems.push(`${label}: banner offers ${got.slug ?? 'nothing'} but origin is ${want.slug ?? 'not a GitHub repo'}`)
    report.push({ id: s.id, host: s.host, cwd: s.workingDirectory, panel: got.state.state, slug: got.slug, want })
    if (distro) parts.push(`${label}: ${want.state.branch ? `on ${want.state.branch}` : 'not a repo'}${want.slug ? `, ${want.slug}` : ''}`)
  }
  page.close()
  if (asJson) console.log(JSON.stringify(report, null, 2))
  if (problems.length) {
    console.error(`FAIL git: ${problems.join('; ')}`)
    process.exit(1)
  }
  const nativeNote = `${native.length} session${native.length === 1 ? '' : 's'} here agree with git`
  console.log(`PASS git: ${parts.length ? parts.join('; ') + '; ' : 'no Ubuntu session (nothing to check); '}${nativeNote}`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
