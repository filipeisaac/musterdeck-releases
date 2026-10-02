#!/usr/bin/env node
/**
 * fixtures.mjs -- the throwaway folders the parity run works in, made and removed by name
 * (WSL parity P9). Nothing outside them is touched.
 *
 *   node suite/fixtures.mjs --create --out <dir> [--distro Ubuntu]
 *   node suite/fixtures.mjs --remove --out <dir>
 *
 * `--create` makes, under one stamp:
 *   - in the distro (Windows only), `~/md-suite-<stamp>/repo`: a git repository with two
 *     commits, a tracked `notes.md`, an untracked `scratch.txt`, and a project skill
 *     `.claude/skills/md-suite-skill/SKILL.md` (so git.mjs, ctrl-click.mjs and skills.mjs
 *     have something real to compare);
 *   - on this machine, `<temp>/md-suite-<stamp>/`: `repo` (the same, when git is installed),
 *     `drop me.txt` (a name with a space, for the drop mapping), and `project` (a folder for
 *     primary.mjs --project).
 * It writes `<out>/fixtures.json` (the paths) and prints it. `--remove` deletes exactly the
 * folders that file names, after checking each is a `md-suite-<stamp>` folder.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { outDirFromArgs, record } from './lib/results.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt = null) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt)
const out = outDirFromArgs()
if (!out) { console.error('--out <dir> is required'); process.exit(2) }
const file = path.join(out, 'fixtures.json')
const win = process.platform === 'win32'
const SKILL = '---\nname: md-suite-skill\ndescription: A throwaway skill the MusterDeck test suite lists, then removes.\n---\n\nNothing to do here.\n'

function wsl(distro, script) {
  const r = spawnSync('wsl.exe', ['-d', distro, '--cd', '~', '-e', 'sh', '-s'], { input: `${script}\n`, encoding: 'utf8', env: { ...process.env, WSL_UTF8: '1' }, timeout: 60_000, windowsHide: true })
  return { code: r.status, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() }
}
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

function gitRepo(dir) {
  fs.mkdirSync(path.join(dir, '.claude', 'skills', 'md-suite-skill'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.claude', 'skills', 'md-suite-skill', 'SKILL.md'), SKILL)
  fs.writeFileSync(path.join(dir, 'notes.md'), '# md-suite\n\nA file to Ctrl+click.\n')
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.email=md-suite@example.invalid', '-c', 'user.name=md suite', ...a], { encoding: 'utf8', windowsHide: true })
  if (git('init', '-q').status !== 0) return false
  git('commit', '-q', '--allow-empty', '-m', 'md-suite seed')
  git('add', 'notes.md', '.claude')
  git('commit', '-q', '-m', 'md-suite notes')
  fs.writeFileSync(path.join(dir, 'scratch.txt'), 'untracked\n')
  return true
}

if (argv.includes('--create')) {
  const stamp = `md-suite-${Date.now().toString(36)}`
  const host = path.join(os.tmpdir(), stamp)
  fs.mkdirSync(host, { recursive: true })
  const fixtures = { stamp, host: { root: host, repo: path.join(host, 'repo'), project: path.join(host, 'project'), dropFile: path.join(host, 'drop me.txt'), git: false }, distro: null }
  fs.mkdirSync(fixtures.host.repo, { recursive: true })
  fs.mkdirSync(fixtures.host.project, { recursive: true })
  fs.writeFileSync(fixtures.host.dropFile, 'dropped on a terminal by the MusterDeck suite\n')
  fixtures.host.git = gitRepo(fixtures.host.repo)
  const evidence = [`this machine: ${host}${fixtures.host.git ? ' (git repository)' : ' (no git here)'}`]
  const distro = arg('--distro')
  if (win && distro) {
    const script = [
      'set -e',
      `d="$HOME/${stamp}/repo"`,
      'mkdir -p "$d/.claude/skills/md-suite-skill"',
      'cd "$d"',
      `printf %s ${q(SKILL)} > .claude/skills/md-suite-skill/SKILL.md`,
      "printf '# md-suite\\n\\nA file to Ctrl+click.\\n' > notes.md",
      'git init -q',
      'git -c user.email=md-suite@example.invalid -c user.name="md suite" commit -q --allow-empty -m "md-suite seed"',
      'git add notes.md .claude',
      'git -c user.email=md-suite@example.invalid -c user.name="md suite" commit -q -m "md-suite notes"',
      "printf 'untracked\\n' > scratch.txt",
      'echo "root=$HOME/' + stamp + '"',
      'echo "repo=$d"',
    ].join('\n')
    const r = wsl(distro, script)
    const kv = Object.fromEntries(r.out.split(/\r?\n/).map((l) => l.split('=')).filter((x) => x.length >= 2).map(([k, ...v]) => [k, v.join('=')]))
    if (r.code === 0 && kv.repo) {
      fixtures.distro = { name: distro, root: kv.root, repo: kv.repo, notes: `${kv.repo}/notes.md` }
      evidence.push(`${distro}: ${kv.repo} (git repository, a project skill, notes.md, an untracked file)`)
    } else {
      evidence.push(`${distro}: could not make the repository (exit ${r.code}): ${r.err.slice(0, 300)}`)
    }
  }
  fs.writeFileSync(file, JSON.stringify(fixtures, null, 2))
  record(out, { id: 'fixtures.create', title: 'Throwaway folders for the run', status: win && distro && !fixtures.distro ? 'FAIL' : 'PASS', evidence })
  console.log(JSON.stringify(fixtures))
} else if (argv.includes('--remove')) {
  if (!fs.existsSync(file)) { console.log('nothing to remove'); process.exit(0) }
  const f = JSON.parse(fs.readFileSync(file, 'utf8'))
  const evidence = []
  const okName = (p) => /md-suite-[a-z0-9]+$/.test(String(p).replace(/[\\/]+$/, ''))
  if (f.host?.root && okName(f.host.root)) {
    fs.rmSync(f.host.root, { recursive: true, force: true })
    evidence.push(`${f.host.root}: ${fs.existsSync(f.host.root) ? 'STILL THERE' : 'removed'}`)
  }
  if (win && f.distro?.root && okName(f.distro.root)) {
    const r = wsl(f.distro.name, `rm -rf -- ${q(f.distro.root)} && test ! -e ${q(f.distro.root)} && echo removed`)
    evidence.push(`${f.distro.name}:${f.distro.root}: ${r.out === 'removed' ? 'removed' : `NOT removed (${r.err.slice(0, 200)})`}`)
  }
  record(out, { id: 'fixtures.remove', title: 'Throwaway folders removed', status: evidence.some((e) => /STILL|NOT removed/.test(e)) ? 'FAIL' : 'PASS', evidence })
} else {
  console.error('usage: fixtures.mjs --create|--remove --out <dir> [--distro Ubuntu]')
  process.exit(2)
}
