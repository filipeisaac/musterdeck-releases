#!/usr/bin/env node
/**
 * preflight.mjs -- is this machine able to run the parity suite? Runs BEFORE the app (WSL
 * parity P9); reads only, changes nothing.
 *
 *   node suite/preflight.mjs --out <dir> [--distro Ubuntu]
 *
 * Records: the Windows build (22621 or later), the Node running the suite (22 or later, with
 * fetch and WebSocket), WSL's version (2.0 or later), the distros and the one picked, the
 * distro's networking mode (mirrored), and what the distro has: claude, node, git, codex
 * (each must be Linux's own, never a /mnt/ path seen through interop), plus whether Windows
 * itself has Claude (for the regression run on a Windows session). Writes `machine.json` and
 * prints it as the last line. Not Windows: records SKIP for the Windows rows.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { outDirFromArgs, record } from './lib/results.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
const win = process.platform === 'win32'
const machine = { platform: process.platform, release: os.release(), node: process.version, nodePath: process.execPath, electron: process.versions.electron ?? null }

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 120_000, windowsHide: true })
  return { code: r.status, out: String(r.stdout ?? '').replace(/\0/g, '').trim(), err: String(r.stderr ?? '').replace(/\0/g, '').trim() }
}

// Node itself.
{
  const major = Number(process.versions.node.split('.')[0])
  const ok = major >= 22 && typeof fetch === 'function' && typeof WebSocket === 'function'
  record(out, {
    id: 'preflight.node', title: 'Node 22 or later runs the suite', status: ok ? 'PASS' : 'FAIL',
    evidence: [`${process.version} at ${process.execPath}${machine.electron ? ` (MusterDeck's own Electron ${machine.electron}, as Node)` : ''}`, `fetch ${typeof fetch}, WebSocket ${typeof WebSocket}`],
  })
}

if (!win) {
  for (const [id, title] of [['preflight.windows', 'Windows 11 22H2 or later'], ['preflight.wsl', 'WSL 2.0 or later, a distro'], ['preflight.distro', 'The distro: networking, claude, node, git, codex']]) {
    record(out, { id, title, status: 'SKIP', evidence: [`not Windows (${process.platform} ${os.release()})`] })
  }
  machine.windowsClaude = null
} else {
  const build = Number(os.release().split('.')[2] ?? 0)
  machine.windowsBuild = build
  record(out, { id: 'preflight.windows', title: 'Windows 11 22H2 or later', status: build >= 22621 ? 'PASS' : 'FAIL', evidence: [`build ${build} (${os.release()})`] })

  const ver = run('wsl.exe', ['--version'])
  const m = ver.out.match(/WSL[^:\n]*:\s*(\d+)\.(\d+)\.(\d+)/)
  const list = run('wsl.exe', ['-l', '-v'])
  const distros = list.out.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean).map((l) => {
    const isDefault = l.startsWith('*')
    const parts = l.replace(/^\*\s*/, '').split(/\s{2,}|\t/).map((x) => x.trim()).filter(Boolean)
    return { name: parts[0], state: parts[1] ?? null, version: parts[2] ?? null, isDefault }
  }).filter((d) => d.name && !/^docker-desktop/i.test(d.name))
  machine.wslVersion = m ? `${m[1]}.${m[2]}.${m[3]}` : null
  machine.distros = distros
  const named = arg('--distro')
  const picked = named ? distros.find((d) => d.name === named) : (distros.find((d) => /^ubuntu/i.test(d.name) && d.isDefault) ?? distros.find((d) => /^ubuntu/i.test(d.name)) ?? distros.find((d) => d.isDefault))
  machine.distro = picked?.name ?? null
  record(out, {
    id: 'preflight.wsl', title: 'WSL 2.0 or later, a distro',
    status: m && Number(m[1]) >= 2 && picked ? 'PASS' : 'FAIL',
    evidence: [`wsl --version: ${ver.out.split(/\r?\n/)[0] || ver.err || `exit ${ver.code}`}`, `distros: ${distros.map((d) => `${d.isDefault ? '*' : ''}${d.name} (${d.state}, v${d.version})`).join(', ') || 'none'}`, `picked: ${picked?.name ?? 'none'}`],
  })

  if (picked) {
    // The login shell's PATH, read the way the app's probe reads it (`$SHELL -lic`), so a
    // claude installed by nvm or into ~/.local/bin is found as the app finds it.
    const script = [
      'P=$("${SHELL:-/bin/bash}" -lic \'printf %s "$PATH"\' </dev/null 2>/dev/null); [ -n "$P" ] && export PATH="$P:$PATH"',
      'echo "networking=$(wslinfo --networking-mode 2>/dev/null)"',
      'for t in claude node git codex; do p=$(command -v $t 2>/dev/null); echo "$t=$p"; done',
      'echo "claudeVersion=$(claude --version 2>/dev/null | head -n1)"',
      'echo "nodeVersion=$(node --version 2>/dev/null)"',
      'echo "codexVersion=$(codex --version 2>/dev/null | head -n1)"',
      'echo "home=$HOME"',
      'echo "shell=$SHELL"',
    ].join('\n')
    const r = run('wsl.exe', ['-d', picked.name, '--cd', '~', '-e', 'sh', '-s'], `${script}\n`)
    const kv = Object.fromEntries(r.out.split(/\r?\n/).map((l) => l.split('=')).filter((x) => x.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').trim()]))
    const linux = (p) => (p && !p.startsWith('/mnt/') ? p : null)
    machine.inDistro = {
      networking: kv.networking || null, home: kv.home || null, shell: kv.shell || null,
      claude: linux(kv.claude), claudeVersion: kv.claudeVersion || null,
      node: linux(kv.node), nodeVersion: kv.nodeVersion || null, git: linux(kv.git),
      codex: linux(kv.codex), codexVersion: kv.codexVersion || null,
      rejected: ['claude', 'node', 'git', 'codex'].filter((t) => kv[t]?.startsWith('/mnt/')).map((t) => `${t}=${kv[t]}`),
    }
    const d = machine.inDistro
    const problems = []
    if (d.networking !== 'mirrored') problems.push(`networking is ${d.networking || 'unknown'}, not mirrored`)
    if (!d.claude) problems.push('no Linux claude in the distro')
    record(out, {
      id: 'preflight.distro', title: 'The distro: networking, claude, node, git, codex', status: problems.length ? 'FAIL' : 'PASS',
      evidence: [
        ...(problems.length ? [problems.join('; ')] : [`${picked.name} is ready`]),
        `networking ${d.networking || '-'}; home ${d.home}; shell ${d.shell}`,
        `claude ${d.claude ?? 'missing'} ${d.claudeVersion ?? ''}; node ${d.node ?? 'missing'} ${d.nodeVersion ?? ''}; git ${d.git ?? 'missing'}; codex ${d.codex ?? 'missing'} ${d.codexVersion ?? ''}`,
        ...(d.rejected.length ? [`Windows copies seen through interop, not counted: ${d.rejected.join(', ')}`] : []),
        ...(r.code !== 0 ? [`exit ${r.code}: ${r.err.slice(0, 300)}`] : []),
      ],
    })
  } else {
    record(out, { id: 'preflight.distro', title: 'The distro: networking, claude, node, git, codex', status: 'FAIL', evidence: ['no distro to check'] })
  }

  const where = run('where.exe', ['claude'])
  machine.windowsClaude = where.code === 0 ? where.out.split(/\r?\n/)[0] : null
  record(out, {
    id: 'preflight.windows-claude', title: 'Claude on Windows itself (for the regression run)', status: 'INFO',
    evidence: [machine.windowsClaude ? `found ${machine.windowsClaude}` : 'not found: the Windows-session regression run uses a shell session only'],
  })
}

if (out) fs.writeFileSync(path.join(out, 'machine.json'), JSON.stringify(machine, null, 2))
console.log(JSON.stringify(machine))
