#!/usr/bin/env node
/**
 * ctrl-click.mjs -- what Ctrl+click on a path opens, for an Ubuntu session and its partner
 * pane (WSL parity P6). A DRY RUN: `window.__mdTest.openPathPlan(candidates, ptyId)` asks main
 * the exact question `shell:openLocalPath` answers and stops before opening anything, so this
 * launches no editor, Explorer or file.
 *
 *   node suite/ctrl-click.mjs --port 9339 [--require-wsl] [--json]
 *
 * For every open Ubuntu session with a folder, and its `<sid>-partner` terminal when it has one:
 *  - the folder plans Explorer on `\\wsl.localhost\<distro>\...` (or `X:\...` under the mount root);
 *  - `~` plans the distro home's host path;
 *  - a file in the folder (the first one `wsl.exe` lists there, when there is one) plans
 *    VS Code's Remote WSL URL (`vscode://vscode-remote/wsl+<distro>/...`, or Cursor's or
 *    Insiders') when Windows opens that kind of file with it, else the share path, or a reveal
 *    for a script; never a `C:\home\...` path;
 *  - `/mnt/c/Windows` plans Explorer on `C:\Windows`;
 *  - a path that is not there plans nothing.
 * And, on any machine, every session here with a folder plans its folder through this machine
 * (native unchanged). Exit 0 with one line on pass, 1 with the reasons.
 */
import { spawnSync } from 'node:child_process'
import { connectToApp, callTestApi, portFromArgs } from './lib/cdp.mjs'

const port = portFromArgs()
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const requireWsl = argv.includes('--require-wsl')
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/** The first regular file directly in a folder of the distro, or null. */
function firstFile(distro, dir) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], {
    input: `find ${q(dir)} -mindepth 1 -maxdepth 1 -type f -name '*.*' 2>/dev/null | sort | head -1\n`,
    encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 30_000, windowsHide: true,
  })
  const line = String(r.stdout ?? '').split(/\r?\n/).find((l) => l.startsWith('/'))
  return line ?? null
}

/** `\\wsl.localhost\<distro>\a\b` for `/a/b`, or `X:\...` under the mount root. */
function hostPathOf(linux, distro, mountRoot = '/mnt/') {
  const root = mountRoot.replace(/\/+$/, '') + '/'
  const m = linux.startsWith(root) ? /^([a-zA-Z])(?:\/(.*))?$/.exec(linux.slice(root.length)) : null
  if (m) return `${m[1].toUpperCase()}:\\${(m[2] ?? '').replace(/\/+/g, '\\')}`
  return `\\\\wsl.localhost\\${distro}\\${linux.replace(/^\/+/, '').replace(/\/+/g, '\\')}`
}

try {
  const page = await connectToApp(port)
  const sessions = (await callTestApi(page, 'sessions')) ?? []
  const terminals = new Set((await callTestApi(page, 'terminals')) ?? [])
  const homes = await callTestApi(page, 'claudeHomes')
  const problems = []
  const parts = []
  const report = []
  const plan = async (cands, ptyId) => {
    const p = await callTestApi(page, 'openPathPlan', cands, ptyId)
    report.push({ ptyId, candidates: cands, plan: p })
    return p
  }
  const ubuntu = sessions.filter((s) => s.host === 'wsl' && s.workingDirectory)
  if (requireWsl && ubuntu.length === 0) problems.push('no Ubuntu session with a folder to check')
  if (ubuntu.length && process.platform !== 'win32') problems.push('an Ubuntu session, but this is not Windows')

  for (const s of process.platform === 'win32' ? ubuntu : []) {
    const distro = String(s.environmentId).slice('wsl:'.length)
    const env = (homes?.homes ?? []).find((h) => h.envId === s.environmentId)
    const mountRoot = env?.pathContext?.mountRoot ?? '/mnt/'
    const home = env?.home?.linux ?? null
    const panes = [s.id, ...(terminals.has(`${s.id}-partner`) ? [`${s.id}-partner`] : [])]
    for (const pty of panes) {
      const label = `${s.label ?? s.id}${pty.endsWith('-partner') ? ' (partner)' : ''}`
      const dir = await plan([s.workingDirectory], pty)
      if (!dir?.ok || dir.via !== 'wsl' || dir.kind !== 'dir' || dir.action !== 'open' || dir.path !== hostPathOf(s.workingDirectory, distro, mountRoot)) {
        problems.push(`${label}: its folder plans ${JSON.stringify(dir)}`)
      }
      if (home) {
        const h = await plan(['~'], pty)
        if (!h?.ok || h.via !== 'wsl' || h.path !== hostPathOf(home, distro, mountRoot)) problems.push(`${label}: ~ plans ${JSON.stringify(h)}`)
      }
      const file = firstFile(distro, s.workingDirectory)
      if (file) {
        const f = await plan([file], pty)
        const okUrl = f?.action === 'url' && /^(vscode|vscode-insiders|cursor):\/\/vscode-remote\/wsl\+/.test(f.url) && f.linuxPath === file
        const okShare = (f?.action === 'open' || f?.action === 'reveal') && f.path === hostPathOf(file, distro, mountRoot)
        if (!f?.ok || f.via !== 'wsl' || !(okUrl || okShare)) problems.push(`${label}: ${file} plans ${JSON.stringify(f)}`)
        else parts.push(`${label}: ${file.split('/').pop()} -> ${f.action === 'url' ? f.editor : f.action}`)
      }
      const win = await plan([`${mountRoot.replace(/\/+$/, '')}/c/Windows`], pty)
      if (!win?.ok || win.via !== 'wsl' || win.path !== 'C:\\Windows' || !win.windowsFile) problems.push(`${label}: /mnt/c/Windows plans ${JSON.stringify(win)}`)
      const none = await plan([`${s.workingDirectory.replace(/\/+$/, '')}/md-suite-no-such-file-${Date.now()}.txt`], pty)
      if (none?.ok) problems.push(`${label}: a missing file plans ${JSON.stringify(none)}`)
    }
    parts.push(`${s.label ?? s.id}: ${panes.length} pane${panes.length === 1 ? '' : 's'} checked`)
  }

  // Native unchanged: a session here plans its own folder through this machine.
  const native = sessions.filter((s) => s.host === 'native' && s.workingDirectory && s.workingDirectory.length > 1)
  for (const s of native) {
    const p = await plan([s.workingDirectory], s.id)
    if (p && p.ok && p.via !== 'native') problems.push(`${s.label ?? s.id}: a session here planned ${JSON.stringify(p)}`)
    if (p && !p.ok && p.via !== 'native') problems.push(`${s.label ?? s.id}: a session here refused through ${p.via}`)
  }
  page.close()
  if (asJson) console.log(JSON.stringify(report, null, 2))
  if (problems.length) {
    console.error(`FAIL ctrl-click: ${problems.join('; ')}`)
    process.exit(1)
  }
  console.log(`PASS ctrl-click: ${parts.length ? parts.join('; ') : 'no Ubuntu session (nothing to check)'}; ${native.length} session${native.length === 1 ? '' : 's'} here plan through this machine`)
  process.exit(0)
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
