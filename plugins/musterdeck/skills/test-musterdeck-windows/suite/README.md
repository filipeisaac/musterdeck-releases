# The WSL parity suite

Scripts that check a running MusterDeck from the outside, through its **test mode**. Started
in WSL parity task P1 (as `tools/wsl-suite/`) with one script; since P9 it lives HERE, inside
the `test-musterdeck-windows` skill, and is the one copy: the skill's `parity` run uses it on a
tester's machine, and `tests/e2e/test-mode.spec.ts` runs it against a dev build. Every script
must run with **nothing but Node 22+**: no `npm install`, no repo, no Playwright (MusterDeck's
own Electron, run as Node, qualifies). `tests/unit/wsl-suite.test.ts` holds that, and that
every check is in `lib/checks.mjs`.

Editing anything here changes the plugin: run `node scripts/stamp-plugin.mjs --bump` in the
same commit (`marketplace-version.test.ts` fails until you do).

## The test mode

Start MusterDeck with `MUSTERDECK_TEST_CDP=<port>` in its environment:

- Chromium's debugging port opens on **127.0.0.1:&lt;port&gt;** (never beyond loopback; the
  protocol has no authentication). `src/main/test-mode.ts`.
- The renderer exposes **`window.__mdTest`**, read-only, only in that mode
  (`src/renderer/test-mode.ts`): `sessions()`, `activeSession()`, `layout()`, `deck()`,
  `readings()`, `launchStates()`, `warmup()`, `environments()`, `terminals()`, and
  `readTerminal(ptyId, lines)` for the text a terminal shows, and (P2, async)
  `claudeHomes()`: each environment's homes as main names them, whether its distro runs and
  whether its `~/.claude` is there; (P3, async) `sessionLog(id, limit)`, what Logs v2 holds
  for a session, and `crewCard(id, limit)`, the Crew card's conversation and the session's
  place in the Crew's activity order, and `resumeConversations(cwd, environmentId?)`, what the
  dialog's Resume tab lists for a folder; (P4, async) `tokenomics(limit)`, the Tokenomics
  page's KPIs, cost by config and newest session rows (each with its `environmentId`), with the
  open sessions' conversation uuids; `memory()`, what the Memory page scans (projects and files,
  each with its `environmentId`), and `memoryRead(path)`, the page's own validated read of one
  file; `projects()`, what the ProjectBrowser lists (each project with its `environmentId`) and
  the Crew's dormant plots; `insights()`, the Insights catalogue with each run's
  `environmentId`; (P5, async) `skills(cwd?, environmentId?)`, what the hotbar's picker and the
  Crew's `/` menu list (skills and commands, a distro's when an environment is named), and
  `distroSkills()`, the bundled skills the app ships and what each distro's first write (backup,
  bundled skills) did this run; (P6, async) `localGit(sessionId)`, the GitHub panel's Local Git
  state and the auto-detect banner's repo for a session (its own calls, with the session's
  Ubuntu environment), and `openPathPlan(candidates, ptyId, environmentId?)`, what a Ctrl+click
  on those paths in that terminal would open: a DRY RUN that opens nothing; (P7, async)
  `wslCodex()`, each live Ubuntu Codex session's distro watch (the rollout it claimed, its last
  update), what each probe found of Codex, and the Ubuntu Codex records' resume pointers;
  `versions()`, each WSL environment's Claude Code version as main knows it (and Sentinel's
  checks), each session's picker lists for the version its CLI runs, the registry's floors and
  the footer's CLI dots; (P8, async) `ram()`, the memory panel's own snapshot (an Ubuntu
  session's row read in its distro and tagged with its environment) beside each session's
  host; `primaryRouting(project?)`, a dry run of where Ask, a new theme's session, the
  add-account default and a project from this machine would run (environment, folder, reason);
  `accounts(identity?)`, the accounts per environment (each Ubuntu account's config dir and, with
  `identity`, who `claude auth status` in the distro says it is: metadata only) beside each
  session's offered accounts, and `accountSwitchPlan(sessionId, profileId)`, a DRY RUN of Switch
  account. Every getter returns a plain JSON copy.

(P9) `dropPlan(ptyId, hostPaths)`: what dropping those files on that terminal would type, a dry
run of the drop handler (`planTerminalDrop`).

Without the variable nothing changes: no switch, no `window.__mdTest`
(`tests/unit/main/test-mode.test.ts`, `tests/unit/renderer/test-mode-api.test.ts`).

**Always use a throwaway data folder**: `MUSTERDECK_TEST_DATA_DIR=<absolute folder>` (honoured
ONLY with `MUSTERDECK_TEST_CDP` set; `src/main/test-mode-data.ts`) makes the app, packaged or
not, keep everything there, use its own Electron folder (and so its own single-instance lock),
and start past every first-run screen; an existing folder is reused as it is, so a relaunch
keeps its sessions. A test run never touches real sessions.

## Running it

macOS, dev build (quit any running dev main first, see CLAUDE.md "Dev-server gotchas"):

```bash
npm run build
S=marketplace/plugins/musterdeck/skills/test-musterdeck-windows/suite
D=$(mktemp -d)
MUSTERDECK_TEST_CDP=9339 MUSTERDECK_TEST_DATA_DIR="$D/data" npx electron . &
node $S/list-sessions.mjs --port 9339
node $S/fixtures.mjs --create --out "$D/out"
node $S/lifecycle.mjs --port 9339 --out "$D/out" --place native --folder <fixtures.json host.repo>
node $S/run-suite.mjs --port 9339 --out "$D/out"
node $S/quit-app.mjs --port 9339 --out "$D/out"
node $S/report.mjs --out "$D/out"
```

Windows, installed build: the skill's `parity` run (SKILL.md, R1 to R14) is the procedure.

## Layout

| File | What |
|---|---|
| `lib/cdp.mjs` | the CDP client: `connectToApp(port)` finds the window that has `__mdTest`, `callTestApi(page, name, ...args)` calls a getter, `page.evaluate(expr)` anything else |
| `list-sessions.mjs` | prints the session list (`--json` for the raw records, each with its `host`) |
| `logs.mjs` | P3: every Ubuntu Claude session has a transcript bound to a Linux path and indexed messages that read back (the Logs pane, global Logs); run after a turn. `--require-wsl` fails with no Ubuntu session |
| `resume-picker.mjs` | P3: the dialog's Resume tab lists each WSL environment's conversations from the distro (its sessions' folders, or `--folder`), each with a Linux transcript path; may start the distro, as the dialog does |
| `crew-card.mjs` | P3: the Crew card shows messages for every Ubuntu Claude session, and each is in the activity order |
| `tokenomics.mjs` | P4: every Ubuntu Claude session's conversation has a Tokenomics row tagged `wsl:<distro>` that cost more than $0, and a session from a saved WSL config is attributed to it with its Cost by config line above $0; run after a turn (the distro is listed every 5 s). `--require-wsl` fails with no Ubuntu session |
| `memory.mjs` | P4: every running WSL environment's memory files are listed under its `~/.claude\projects\<project>\memory\` share path, tagged with it, and one reads back through the page; a stopped distro lists nothing. `--require-wsl` fails with no running WSL environment, `--require-files` when one has no memory |
| `projects.mjs` | P4: every open Ubuntu Claude session's folder is listed as a project of its environment (the ProjectBrowser, `discovery:projects`), no dormant plot is drawn for a folder open in that environment, and every WSL plot carries its environment. `--require-wsl` fails with no Ubuntu session |
| `insights.mjs` | P4, OPT-IN: read only by default (every recorded Ubuntu run says why it failed, if it did). `--run [--environment wsl:<distro>] [--timeout-min 15]` starts one run in that distro through the page's own API and passes when it completes there with a report; minutes long and it spends the account's tokens, so only on purpose |
| `skills.mjs` | P5: for every running WSL environment and each folder its Ubuntu sessions have open, the picker's catalogue equals what `wsl.exe` lists in the distro (project, user and installed-plugin skills and commands, native rules); after an Ubuntu Claude launch this run, the distro has the backup and every bundled skill with its stamp (unless left to a plugin or the user's copy). `--require-wsl` fails with no running WSL environment |
| `git.mjs` | P6: for every Ubuntu session with a folder, the GitHub panel's Local Git state and the banner's detected repo equal what `git -C <folder>` says through `wsl.exe` (branch, ahead/behind, staged, unstaged, untracked, stashes, last five commits, `origin`); sessions here are held to this machine's git the same way. `--require-wsl` fails with no Ubuntu session |
| `ctrl-click.mjs` | P6: a dry run of Ctrl+click (`openPathPlan`, nothing is opened) for every Ubuntu session and its partner pane: the folder and `~` plan Explorer on the share path, a file in the folder plans VS Code's Remote WSL URL (or the share path, or a reveal for a script), `/mnt/c/Windows` plans `C:\Windows`, a missing path plans nothing; a session here plans its folder through this machine. `--require-wsl` fails with no Ubuntu session |
| `codex.mjs` | P7: for every live Ubuntu Codex session, the distro watch claimed a rollout whose first line (read through `wsl.exe`) is the same Codex session, sent a status, and the record's resume pointer names it; each probed environment says whether it has Codex. `--run [--environment wsl:<distro>] [--timeout-s 120]` spawns ONE read-only Codex PTY in the distro's home through the page's `pty.spawn`, waits for ready and a claimed rollout with a status, reads it through `wsl.exe`, and kills it; a distro without Codex is SKIPPED (exit 0). `--require-wsl` fails when no WSL environment was probed |
| `versions.mjs` | P7: every probed WSL environment's version is what its claude says through `wsl.exe` and what Sentinel checked; every Ubuntu Claude session's model and effort lists are the registry's entries its version meets (its distro's, or its pin), every other session's the whole registry; the footer has a CLI dot per environment, the Primary first, each agreeing with its probe (one "CLI" dot with none). `--require-wsl` fails when no WSL environment was probed |
| `ram.mjs` | P8: every live Ubuntu Claude or Codex session has a RAM row tagged with its environment holding more than a few MB, and on Windows it matches the distro's own `ps` over the processes carrying its id (within 30% or 64 MB); no native row carries an environment. `--require-wsl` fails when no Ubuntu agent session is open |
| `primary.mjs` | P8: Ask, a new theme's session and the add-account default run in the WSL environment when the Primary is Ubuntu or Windows has no Claude, a project from this machine only when Windows has no Claude, each at a Linux folder (on Windows the help folder's mount path turns back into a Windows path through `wslpath -w`); nothing is staged or created. `--project <folder>` names the project to route; `--require-wsl` fails with no WSL environment |
| `accounts.mjs` | P8: accounts are listed per environment and no session is offered one from elsewhere; every finished Ubuntu account (its distro running) is who `claude auth status` says under its `CLAUDE_CONFIG_DIR` (the distro's own login with none), asked by the app and, on Windows, again through `wsl.exe` (identity metadata only); an added account's config dir is `~/.musterdeck/profiles/<id>/.claude`; Switch account as a dry run for an Ubuntu Claude session with a choice (`--switch <id>` to pick one) respawns it in its environment with the new account, resuming its conversation. `--require-wsl` fails with no Ubuntu account recorded |
| `distro-home.mjs` | P2: every environment's Claude and Codex home matches its probe `home`, a running distro's `~/.claude` is found through the distro reader, a stopped one is not touched (`--require-wsl` fails when no WSL environment resolved) |
| `lib/results.mjs` | the verdicts: every driver appends `{ id, title, status, evidence[] }` lines to `<out>/results.jsonl` (`record`, `step`); the last line per id wins |
| `lib/ui.mjs` | drives the window like a person: find a control by what it says (`click`, `contextMenu`, `setValue`, `setChecked`), type into a terminal through its xterm (`typeInTerminal`), read it back, take a screenshot |
| `lib/png.mjs` | PNG pixels with nothing but zlib, for the colour check |
| `lib/checks.mjs` | the read-only checks `run-suite.mjs` runs, in order, and the list of drivers |
| `lib/human.mjs` | what only a person can judge, each with what to do and what to look for |
| `preflight.mjs` | before the app: Windows build, the suite's Node, WSL, the distro (networking, its own claude, node, git, codex), Claude on Windows; writes `machine.json` |
| `setup-environment.mjs` | Settings > Environments: Add Ubuntu, Run the check, and what the probe found (SKIP off Windows) |
| `fixtures.mjs` | `--create` the throwaway repo in the distro and the folders on this machine (`fixtures.json`); `--remove` exactly those |
| `lifecycle.mjs` | whole sessions through the app's controls, `--place ubuntu|native`: shell session, colour from a screenshot, drop plan, rename, split, archive and restore; with `--claude` a turn with a marker word (Working on the deck), a scheduled `/rename`, the Partner Terminal's `pwd`, Restart, archive and restore keeping the conversation; `--phase resume` after a relaunch |
| `run-suite.mjs` | every check in `lib/checks.mjs`, `--wsl` adding `--require-wsl`, `--codex-run` and `--insights-run` the opt-in runs |
| `quit-app.mjs` | closes the window and answers Save Sessions; waits for the app to exit |
| `screenshot.mjs` | a PNG of the window, after switching view or session |
| `type.mjs` | types a line into one terminal (for the human checks) |
| `report.mjs` | `findings.md` from the results; `--set <id>` records a person's answer |

A new check is one more `*.mjs` next to these, importing `lib/cdp.mjs`, exiting 0 on pass and
1 on fail with one line saying why, AND one more entry in `lib/checks.mjs` (the unit test fails
on a check that is not listed there or a script SKILL.md names that does not exist). Checks READ through `__mdTest`; anything they must DO
(open a dialog, type, click) goes through the page with `page.evaluate` or CDP `Input.*`, the
way a person would, never through a store.
