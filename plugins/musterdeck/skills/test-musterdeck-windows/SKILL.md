---
name: test-musterdeck-windows
description: Run MusterDeck's WSL test on a Windows 11 machine with Ubuntu in WSL. By default the parity run - Claude installs the test build, starts it in a test mode against a throwaway data folder, drives Ubuntu and Windows sessions through the app itself and runs the whole automated suite (about 60 checks), then asks the person only for what needs eyes or would disrupt their machine - writes a findings report with screenshots and logs into one zip on the Desktop to send back, and removes every trace afterwards. Also runs the older phase 1b and spike passes when asked. Use when asked to test MusterDeck on Windows, run the WSL checks, the parity suite or the phase 1b test, run /test-musterdeck-windows, or "do the MusterDeck test Filipe asked for".
---

# Testing MusterDeck on Windows (the WSL test)

Filipe is building Claude sessions that run inside Ubuntu (WSL) for MusterDeck. Some of it
can only be checked on a real Windows 11 machine with Ubuntu. This skill runs those checks
on THIS machine, writes them up, and cleans up afterwards. The person running it is
helping, so be quick, plain and kind: say what each step is for in one line, never make
them read the procedure.

## Which run

`/test-musterdeck-windows [parity | phase-1b | spike] [tag]`. **With no argument, run
`parity`.**

| Run | Build (tag) | What it covers | Steps |
|---|---|---|---|
| `parity` | the tag Filipe named, else the newest release (see R3) | every feature of an Ubuntu session beside a Windows one, driven and checked by Claude through the app's test mode; a short list for the person at the end | 0, then R1 to R14, then 6 and 7 |
| `phase-1b` | `v1.0.58-wsl-preview` (status bar `CLI v1.0.58`), unless Filipe named another | the whole Ubuntu experience by hand: setting Ubuntu up, Ubuntu Claude sessions, status, notifications, resume, drops, badges, `wsl --shutdown`, and a colour check | 0, 1, 2, then P1 to P11, then 5 to 7 |
| `spike` | `v1.0.39-wsl-preview` (`CLI v1.0.39`) | the eight measurements taken before anything was built | 0, 1, 2, 3, 4, then 5 to 7 |

If Filipe's message names a different tag, use his. Say which run this is in the first
line of `findings.md`.

**What it does, in order:** check the machine; install the build; run the checks of the
chosen run; write `findings.md` with screenshots and logs and zip it on the Desktop;
remove MusterDeck and its data (after confirming); say where the zip is and to send it to
Filipe.

**What it never does:** send anything anywhere (the person sends the zip themselves);
touch their own Claude Code setup beyond the files MusterDeck itself created; delete
anything before the zip exists and they have said yes. In the parity run, the app under
test never sees their real MusterDeck data: it runs against a throwaway data folder.

## Where this is running

Claude Code may be running on Windows (PowerShell) or inside Ubuntu (WSL). Both work.

- **On Windows**: run the Windows commands below as they are, and reach Ubuntu with
  `wsl -d <distro> -- bash -lc '<command>'`.
- **Inside WSL** (`uname -s` is `Linux` and `/proc/version` mentions `microsoft`): run the
  Ubuntu commands directly, and the Windows ones through
  `powershell.exe -NoProfile -Command '<command>'`. Windows paths are under `/mnt/c/`.
  The parity suite's scripts must run on WINDOWS (they call `wsl.exe` and read Windows
  paths), so in the parity run put every `mdnode` line inside one `powershell.exe` call.

Set `$env:WSL_UTF8 = "1"` (or `WSL_UTF8=1`) before any `wsl.exe` call so its output is
readable text instead of UTF-16.

## The parity run (R1 to R14)

Claude runs this one end to end. The app has a **test mode**: started with
`MUSTERDECK_TEST_CDP=<port>` it opens a debugging port on 127.0.0.1 only, and
`MUSTERDECK_TEST_DATA_DIR=<folder>` (honoured only together with it) gives it a throwaway
data folder, seeded past the first-run screens, with its own Electron folder. The suite in
this skill's `suite/` folder drives the app through that port the way a person does (it
clicks, types and reads what the window shows) and records every verdict with its evidence
in `results.jsonl`; `report.mjs` turns that into `findings.md`. The suite needs nothing but
Node 22 or later: no npm, no repo.

Record every check, even a pass. Do not stop at a FAIL: note it and go on, unless a later
step needs what failed (then say so and skip it). Talk to the person only where a step says
so, and at R12.

### R1. The suite and Node

Do step 0 (the findings folder `$out`) first. Then:

```powershell
$suite = Join-Path "<this skill's base directory>" "suite"     # the folder beside this SKILL.md
$mdExe = Join-Path $env:LOCALAPPDATA "Programs\MusterDeck\MusterDeck.exe"
$script:nodeOk = $false
try { $script:nodeOk = [int]((node --version) -replace '^v','').Split('.')[0] -ge 22 } catch {}
function mdnode {
  if ($script:nodeOk) { & node @args; return }
  # No Node 22 here: MusterDeck's own Electron is a Node 24 (fetch and WebSocket built in).
  $q = ($args | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
  $o = New-TemporaryFile; $e = New-TemporaryFile
  $env:ELECTRON_RUN_AS_NODE = '1'
  try {
    $p = Start-Process -FilePath $mdExe -ArgumentList $q -NoNewWindow -Wait -PassThru -RedirectStandardOutput $o -RedirectStandardError $e
    Get-Content $o; Get-Content $e | Write-Host; $global:LASTEXITCODE = $p.ExitCode
  } finally { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; Remove-Item $o, $e -ErrorAction SilentlyContinue }
}
```

Nothing is downloaded for Node: with no Node 22, the suite runs on the app it tests, so R2
then waits until R3 has installed it. `ELECTRON_RUN_AS_NODE` must never be set while the app
itself is started (it would start as Node, not as MusterDeck); `mdnode` sets it only for its
own child and removes it.

### R2. Preflight

```powershell
mdnode "$suite\preflight.mjs" --out $out
```

It records the Windows build, the Node running the suite, `wsl --version`, the distros (it
picks Ubuntu; pass `--distro <name>` if the person uses another), the distro's networking
mode and its own `claude`, `node`, `git` and `codex` (never a `/mnt/` copy), and whether
Windows itself has Claude. Its last line is `machine.json`: keep `distro`,
`inDistro.codex` and `windowsClaude` for later steps (`$distro = "<machine.distro>"`). A Windows build before 22621 or no
distro: stop, zip (R14) and clean up. NAT networking or no Claude in Ubuntu: tell the person
(most Ubuntu checks will fail), and ask whether to go on. No `node` in Ubuntu: Ubuntu sessions
still work (since 1.0.115 a plain-shell status line covers them), so go on and note it.

### R3. Install the build

Is MusterDeck already installed, and does the person use it for real work? Ask. If it is
running, ask them to quit it (the test app must be the only MusterDeck running). Say
plainly that step 6 will remove the app at the end, after asking. Their own MusterDeck data
is never opened by this run.

The tag: the one Filipe named, else the newest release. Ubuntu support ships in the regular
releases since 1.0.107, so the `*-wsl-*` pre-releases are history:

```powershell
(Invoke-RestMethod "https://api.github.com/repos/filipeisaac/musterdeck-releases/releases/latest").tag_name
```

Install it with the **`install-musterdeck`** skill, naming that tag (it verifies the
SHA-256). Do NOT let it launch the app for real use: if it opens MusterDeck, quit it
(`taskkill /IM MusterDeck.exe`) before R4. Record the tag and
`(Get-Item $mdExe).VersionInfo.ProductVersion`.

### R4. Start the app in test mode

```powershell
$port = 9339
$dataDir = Join-Path $env:TEMP "md-parity-$stamp"
function Start-TestApp {
  $env:MUSTERDECK_TEST_CDP = "$port"; $env:MUSTERDECK_TEST_DATA_DIR = $dataDir
  try { Start-Process -FilePath $mdExe } finally { Remove-Item Env:MUSTERDECK_TEST_CDP, Env:MUSTERDECK_TEST_DATA_DIR -ErrorAction SilentlyContinue }
}
Start-TestApp
mdnode "$suite\list-sessions.mjs" --port $port
```

`list-sessions` waits for the window and should say `0 session(s)`. If nothing answers,
check no other MusterDeck is running and that port 9339 is free, then try another port.

`Start-TestApp` starts the app from THIS shell, so it inherits this Claude session's
environment, the signed-in account included (`CLAUDE_CODE_USER_EMAIL` and friends). From
1.0.143 the app strips those before anything it spawns sees them. On an older build every
`account-*` check in R12 fails with "already here" two seconds after the sign-in starts:
record that as the build's fault, not the person's browser.
Ask the person to leave the MusterDeck window open and not to click in it until R12 (it may
sit behind other windows; it must not be minimised, or its screenshots come out blank).

### R5. Set Ubuntu up in the app

```powershell
mdnode "$suite\setup-environment.mjs" --port $port --out $out --distro $distro
```

It answers the "Ubuntu found" prompt (or opens Settings > Environments), clicks Add Ubuntu
and Run the check, and records what the probe found. Its last line names the
`environmentId` (`wsl:<distro>`) and says whether Ubuntu's Claude is signed in. **Not
signed in**: the person must do it once (a sign-in in the browser): ask them to open
Settings > Environments in the test window and click **Sign in** under Ubuntu, finish it,
and close that tab; then run setup-environment again.

### R6. Fixtures

```powershell
mdnode "$suite\fixtures.mjs" --create --out $out --distro $distro
```

It makes `~/md-suite-<stamp>/repo` in Ubuntu (a git repository with a project skill, a
tracked `notes.md` and an untracked file) and `%TEMP%\md-suite-<stamp>\` on Windows (a
repo, `drop me.txt`, a `project` folder), and writes `fixtures.json`. Read it: the paths
below come from it (`distro.repo`, `host.repo`, `host.dropFile`, `host.project`).

### R7. An Ubuntu session's whole life

```powershell
mdnode "$suite\lifecycle.mjs" --port $port --out $out --place ubuntu --folder <distro.repo> --claude --drop "<host.dropFile>"
```

Through the app's own controls, with a verdict per step: a Shell-only Ubuntu session from
the New Session dialog; `TERM` and `COLORTERM`, then truecolour blocks sampled from a
screenshot (`colour-ubuntu.png`; Windows must draw them at the exact colours); the drop
mapping (`'/mnt/c/...'`); Rename; Split right and merge; Archive (from that tab's own menu)
and Restore (from that session's own row); the sidebar card's archive button; Close Session
taking two clicks; Close All asking first. Then a Claude session with a Partner Terminal:
ready (a folder trust question is answered by moving to its "Yes" option, never a bare
Enter); one cheap turn with a marker word, seeing Working on the deck and the reply after
the prompt; a scheduled `/rename`
due now (a local command, no tokens) that renames the session, to a name WITH spaces (they
ran together until 1.0.109); the Partner Terminal's `pwd`, and on 1.0.121 and later that it
rolls up from the bottom under Claude at about 30% of the pane; a message scheduled an hour
ahead putting the session On watch on the deck AND on the Crew, where its figure must stand
at its building wearing the clock badge (`crew-watch-<place>.png`; the clock never drew
before 1.0.124), then cancelled; this also visits the Crew before the archive below, which
lost the session before 1.0.110; on 1.0.136 and later, Play: Claude is asked for a code block
whose command prints a random number, its Play button is clicked, the Terminal prints the
number, and after "done" Claude answers with it, which only the note on that message can tell
it (`play-<place>.png`);
Rename from the sidebar; Restart (same conversation); Archive and Restore (same
conversation). It spends five or six short turns on the Ubuntu account in total (with R11).

### R8. The same on a Windows session (the regression run)

```powershell
mdnode "$suite\lifecycle.mjs" --port $port --out $out --place native --folder "<host.repo>" --drop "<host.dropFile>" <--claude only if windowsClaude>
```

The same steps on a Windows session in the same app, so nothing that works for Windows
broke on the way (Play runs a PowerShell `Get-Random` there). Without Claude on Windows, the
shell half only.

### R9. Every check in the suite

Say first, in one line, that the Insights run takes several minutes and spends tokens on the
Ubuntu account. Then:

```powershell
mdnode "$suite\run-suite.mjs" --port $port --out $out --wsl --environment wsl:$distro --project "<host.project>" --insights-run <--codex-run only if inDistro.codex>
```

`--wsl` makes "nothing Ubuntu to check" a FAIL, so every check really looked at the Ubuntu
sessions R7 made: Logs, the Crew card, the Resume tab, Tokenomics, Memory, projects and
plots, Insights, skills, git, Ctrl+click plans, Codex, versions, RAM, Primary routing and
accounts, each against what `wsl.exe` says in the distro. Then `pages`: every page and
Settings tab opens and draws, with no renderer exception. Each line is recorded.

### R10. Screenshots

```powershell
mdnode "$suite\screenshot.mjs" --port $port --out $out --name r10-chat-ubuntu --session <the Ubuntu Claude session id from lifecycle-ubuntu.json>
mdnode "$suite\screenshot.mjs" --port $port --out $out --name r10-crew --view Crew
mdnode "$suite\screenshot.mjs" --port $port --out $out --name r10-tokenomics --view Tokenomics
mdnode "$suite\screenshot.mjs" --port $port --out $out --name r10-chat --view Chat
```

Read each back. The Chat one should show UBUNTU and WINDOWS badges on the tabs and rows.

### R11. Quit, start again, resume

```powershell
mdnode "$suite\quit-app.mjs" --port $port --out $out
Start-TestApp
mdnode "$suite\lifecycle.mjs" --port $port --out $out --place ubuntu --folder <distro.repo> --phase resume
mdnode "$suite\lifecycle.mjs" --port $port --out $out --place native --folder "<host.repo>" --phase resume
```

`quit-app` closes the window and answers the close dialog with Save Sessions, as a person
would. After the restart the sessions must be back with their names, and each Claude
session, asked for the marker word, must answer it from the SAME conversation.

### R12. The human checks

Tell the person the automated part is done, and that a few things need their eyes. Go
through the items below in order, one at a time: say what to do and what to look for, help
with anything Claude can do (typing into a session with
`mdnode "$suite\type.mjs" --port $port --pty <id> --text "<line>"`, opening a folder in
Explorer, taking a screenshot with `screenshot.mjs`, checking a folder in Ubuntu), then
record their answer in their words:

```powershell
mdnode "$suite\report.mjs" --out $out --set <id> --status PASS|FAIL|SKIP --note "<what they saw>"
```

Skip an item the person cannot do (no second account, no VS Code, no Codex) with `SKIP`
and the reason. The items (also in `suite/lib/human.mjs`, which the report lists with
exactly this wording):

| id | What | Needs |
|---|---|---|
| `toast` | a Windows notification from an Ubuntu session's permission request, clicked | eyes |
| `cloud-title` | the renamed Ubuntu session's name on claude.ai or the phone | another device or a browser |
| `explorer-drag` | a real drag of `drop me.txt` from Explorer onto the Ubuntu shell | a hand |
| `vscode` | Ctrl+click `notes.md` in the Ubuntu Partner Terminal opens VS Code in WSL | VS Code installed |
| `crew` | the Crew shows each md-suite session, the Ubuntu card shows the marker | eyes |
| `crew-roam` | an idle bot dragged to another zone stays there; one dropped off every zone walks to the nearest | a hand |
| `drawer` | the Terminal button rolls a terminal up under Claude, resizes, Esc returns to Claude, reopening keeps it | a hand |
| `play-error` | the Play and Copy pill beside a command Claude wrote; Copy, then Play runs it in the Terminal, and "I get an error" is enough for Claude to name it (1.0.136) | a hand |
| `account-add` | Settings > Accounts > Add an account in Ubuntu, sign in with a second account | a sign-in in the browser |
| `account-same` | signing in with the account Ubuntu already uses is refused | a sign-in |
| `account-abandon` | closing the sign-in tab early leaves nothing (Claude checks `~/.musterdeck/profiles`) | a hand |
| `account-session` | a session on the added account; Switch and back keep the conversation; then Claude re-runs `run-suite.mjs --wsl --only logs,tokenomics,skills,accounts` | a hand |
| `account-usage` | Account usage and the Limits card: UBUNTU tags, real figures; re-auth refreshes | eyes, a sign-in |
| `account-default` | the default account pre-selects for Ubuntu only; Insights under the added account | a hand |
| `account-remove` | Remove refused while its session is open, then removed (Claude checks the folder) | a hand |
| `codex-human` | a Codex turn in Ubuntu shows context and cost, resumes after a relaunch, and a Codex review from the Ubuntu Claude session | Codex in Ubuntu |
| `wsl-shutdown` | `wsl --shutdown`: Disconnected, Restart, same conversation; usage panels do not start Ubuntu | **an explicit yes** |

`toast`, when no notification appears: Windows stores, and never shows, the notifications of
an app it does not list as installed. Check `Get-StartApps | Where-Object { $_.AppID -eq
'com.musterdeck.app' }` (nothing listed: say so in the note, and that a sign-out and back in
usually clears it), the app log's `[notify]` lines, and that Do not disturb is off. Builds
before 1.0.144 posted under `electron.app.MusterDeck` and never showed one.

`wsl-shutdown` stops everything running in WSL, Docker included: ask, explain that, and do
it only on a clear yes. **Never** from inside WSL (it would end this conversation): then give
the person the steps to do after the zip exists, and ask them to add what they saw to their
reply to Filipe. After it, the app may need Restart on each Ubuntu tab; record what happened.

### R13. Logs

From the THROWAWAY data folder (never the person's real one):

```powershell
$appLog = Join-Path $dataDir "debug\app.log"
Select-String -Path $appLog -Pattern '\[wsl\]' | ForEach-Object Line | Set-Content (Join-Path $out "wsl-lines.txt")
Get-Content $appLog -Tail 600 | Set-Content (Join-Path $out "app-log-tail.txt")
Get-Content (Join-Path $dataDir "debug\user-actions.log") -Tail 800 | Set-Content (Join-Path $out "user-actions-tail.txt")
Copy-Item (Join-Path $dataDir "resources\CONFIG\environments.json") (Join-Path $out "environments.json")
```

`environments.json` holds no secrets (environment names, folders, the Primary).

### R14. Write it up and zip it

```powershell
mdnode "$suite\quit-app.mjs" --port $port --out $out
mdnode "$suite\fixtures.mjs" --remove --out $out
mdnode "$suite\report.mjs" --out $out --run parity --build "<tag>"
Compress-Archive -Path "$out\*" -DestinationPath "$out.zip" -Force
```

Read `findings.md` back once: the summary table lists every automated check and every human
one ("not done" for any that was not answered, never a pass). In your message to the person,
give the counts (passed, failed, skipped, human answered) and name each FAIL in one line.
Then step 6, where the throwaway data folder `$dataDir` goes first (it is ours: no question
needed, but list it), then the rest only after their yes.

## 0. The findings folder

Create it first; every step writes into it.

```powershell
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$out = Join-Path ([Environment]::GetFolderPath("Desktop")) "musterdeck-wsl-findings-$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null
```

Keep a running `findings.md` in it (template in step 5). Record every command's raw output
under its check, even when it passes: Filipe reads the raw text, not the verdict.

**Screenshots**, when a step asks for one: bring the window into view (ask the person),
then capture the whole screen:

```powershell
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
$bmp.Save((Join-Path $out "<NN-name>.png")); $g.Dispose(); $bmp.Dispose()
```

Read the screenshot back to check it shows what it should before moving on.

## 1. The machine

```powershell
[Environment]::OSVersion.Version          # build must be 22621 or later (Windows 11 22H2)
wsl --version                              # WSL 2.0 or later, from the Store
wsl -l -v                                  # the distros, and which is the default
```

Pick the distro: the default one, or the one named Ubuntu if there are several (ask if
unsure). Then, in it:

```bash
command -v claude; claude --version; command -v node; node --version; echo $SHELL
```

Reject a `claude` or `node` whose path starts with `/mnt/`: that is the Windows copy seen
through interop, not Ubuntu's. Record all of it as **Machine**. If the build is older than
22621, or there is no WSL distro, stop here: write that in `findings.md`, zip it (step 5),
and skip to the cleanup (step 6), because the preview cannot run.

## 2. Install the build

Is MusterDeck already installed, and does the person use it for real work? Ask. If they
do, say plainly that step 6 will remove it and its data at the end, and get a yes before
going on (they can also stop here).

Then install the build with the **`install-musterdeck`** skill, naming the run's tag (see
*Which run*). It downloads, verifies and runs the installer. Ask the person to open
MusterDeck and confirm the status bar shows the run's `CLI v...`.

## 3. The panel (spike run only)

Ask the person to open **Settings > General > WSL (preview)**, click **Check Ubuntu**,
read the list of commands it will run, then click **Run the check**. When the answers
show, take screenshot `01-panel.png`. Then ask them to click **Open Ubuntu terminal**
and leave that tab open.

## 4. The eight checks (spike run only)

Record each as `PASS`, `FAIL` or `INFO` (a measurement with no right answer), with the raw
output. Do not stop at a FAIL: every answer is useful.

**The data folder and the bridge**, needed by checks 3 and 8:

```powershell
$reg = "HKCU:\Software\Claude Command Center"
$dataDir = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).DataDirectory
if (-not $dataDir) { $dataDir = Join-Path $env:LOCALAPPDATA "Claude Command Center" }
$resDir = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).ResourcesDirectory
if (-not $resDir) { $resDir = Join-Path $dataDir "resources" }
$bridge = Join-Path $resDir "scripts\claude-multi-statusline.js"
$appLog = Join-Path $dataDir "debug\app.log"
```

The bridge's Ubuntu path: `wsl -d <distro> -- wslpath -u '<$bridge>'`.

**The hooks port**, needed by check 2: MusterDeck's gateway answers `POST /hook/x` with
404, somewhere from 19334 up. Galley Hatch (a fork) can listen in the same range, so keep
only a port owned by a `MusterDeck` process:

```powershell
$mdPids = (Get-Process MusterDeck -ErrorAction SilentlyContinue).Id
foreach ($p in 19334..19343) {
  $owner = (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue).OwningProcess
  if (-not ($owner | Where-Object { $mdPids -contains $_ })) { continue }
  try { Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:$p/hook/x" -UseBasicParsing -TimeoutSec 2 | Out-Null }
  catch { if ($_.Exception.Response.StatusCode.value__ -eq 404) { $hooksPort = $p; break } }
}
```

No port found means the gateway is not running: record that as check 2's answer (`FAIL`,
"no gateway") and copy the hooks lines from `app.log`.

1. **WSL and networking** (`INFO`, and `FAIL` if not mirrored): `wsl --version`, the
   Windows build, and `wsl -d <distro> -- wslinfo --networking-mode`. Mirrored networking
   is what the design needs. If it says `nat`, record it; do not change `.wslconfig`.
2. **A request from Ubuntu reaches MusterDeck as local**: from Ubuntu,
   `curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:<hooksPort>/hook/x`.
   `PASS` on `404`. `FAIL` on `403` (then copy the `[wsl] hooks gateway refused` line
   from `app.log`) or on no answer at all (`000`).
3. **A status-line update from Ubuntu lands in Windows**: from Ubuntu, once,
   `echo '{}' | CLAUDE_MULTI_SESSION_ID=probe node '<bridge's Ubuntu path>'`. `PASS` when
   `<resDir>\status\probe.json` exists on Windows afterwards and `app.log` has a
   `[wsl] statusline tick from an unknown session id=probe` line.
4. **Closing a tab ends Ubuntu's Claude**: ask the person to type `claude` in the Ubuntu
   tab in MusterDeck, wait until it is up, then close that tab. Then, from Ubuntu:
   `ps -eo pid,ppid,etime,args | grep '[c]laude'`. `PASS` when no Claude started in the
   last few minutes is listed; `FAIL` with the output otherwise. (Their own Claude, the one
   running this skill, may be listed when this runs inside WSL: tell them apart by start
   time and parent.)
5. **Resizing reaches Claude**: ask them to open a new Ubuntu tab (the panel's button),
   start `claude`, and resize the MusterDeck window a few times. Ask: did Claude's screen
   redraw to fit each time? Take `05-resize.png`. `PASS` or `FAIL` by their answer.
6. **The clocks agree** (`INFO`): at the same moment, Ubuntu `date +%s` and Windows
   `[DateTimeOffset]::Now.ToUnixTimeSeconds()`; record both and the difference. Then ask
   whether they can put the PC to sleep for a minute and wake it: if yes, measure again
   after. If not, record "not measured after sleep".
7. **How `claude auth status` shows the account** (`INFO`): run it in Ubuntu and record
   the output as it is (it shows their email, which is fine to send to Filipe; ask if
   unsure).
8. **500 status-line writes while MusterDeck watches** : from Ubuntu,
   `for i in $(seq 500); do echo '{}' | CLAUDE_MULTI_SESSION_ID=probe node '<bridge>' || echo FAILED; done | sort | uniq -c`.
   `PASS` when nothing says `FAILED` and no error is printed; also note any new error lines
   in `app.log` since check 3.

## The phase 1b run (P1 to P11)

Record each step as `PASS`, `FAIL` or `INFO`, with what the person saw in their words and
the screenshot named in the step (taken as in step 0, read back before moving on). Do not
stop at a FAIL: note it and go on, unless a later step needs what failed (then say so and
skip it). The data folder and `app.log` are found as in step 4's first block
(`$dataDir`, `$appLog`); run that block now.

**If this skill is running INSIDE WSL**, two things would end this conversation: Switch's
"Restart WSL now" (P1) and `wsl --shutdown` (P8). Do not do either from here. In P1 choose
**Later**; leave P8 until after the zip exists (step 5), then give the person P8's
instructions to do on their own and ask them to add what they saw to their reply to Filipe.

### P1. Setting Ubuntu up (Settings > Environments)

1. When MusterDeck first opened, did a small window ask "**Ubuntu found. Set it up as an
   environment?**"? Ask. If it is still showing, take `p1-prompt.png` and have them click
   **Set it up** (it opens Settings > Environments). If it never showed, record that
   (`INFO`; it shows only once, and only while no Ubuntu environment is set up), and have
   them open **Settings > Environments**.
2. Click **Add Ubuntu**. A card lists the exact commands it will run; have them read it,
   then click **Run the check**. Take `p1-environments.png` once the rows show.
3. Record every row (Claude version, signed in as, networking, node, status line). Each
   row that says `!` has its fix beside it:
   - **Not signed in**: click **Sign in**. A tab opens in Ubuntu running `claude`; have
     them sign in as they would in their own terminal, then close that tab. The row should
     turn to "Signed in as ..." by itself within a few seconds (`PASS` if so).
   - **NAT networking**: say what **Switch** does (it changes `.wslconfig` for every distro
     and Docker Desktop, and WSL then needs a restart that stops everything running in it)
     and only with their yes, click it and follow its two questions.
   - **Claude not installed**: record it; the rest of the run needs Claude in Ubuntu.
4. **Primary and folders**: click **Make Primary** on Ubuntu (the badge moves). Set
   Ubuntu's projects folder with **Browse** (the picker should open inside Ubuntu's home;
   pick a folder there) and check Windows' projects folder is the one they use. Take
   `p1-primary.png`.
5. Open **Show advanced / diagnostics** under Ubuntu and copy its rows into the findings
   (they are what the probe found).

### P2. An Ubuntu Claude session from the dialog

1. **New Session**. The switch under "New Session" should read **Ubuntu | Windows | SSH**,
   with Ubuntu selected (it is the Primary), and the line "A session stays in the
   environment it was opened in". The folder field shows Ubuntu's projects folder. Take
   `p2-dialog.png`.
2. Type a Windows folder (for example `C:\Users\<them>\Desktop`) into the folder field and
   create nothing yet: on Create it becomes `/mnt/c/...`. Then set it back to a folder in
   Ubuntu's home, give the session a name, and **Create**.
3. The tab may say **Starting Ubuntu...** for a moment, then Claude starts. Take
   `p2-session.png`. In Ubuntu, `ps -eo pid,args | grep '[c]laude'` should list a Linux
   `claude` with `--settings` (`PASS`).
4. Look at the status line under the terminal: the account should be the Ubuntu sign-in
   from P1, and context and model should fill in after the first answer (no status line
   at all is `FAIL` unless P1 said "No status line").
5. Type `/exit`: the tab should drop to an Ubuntu shell in the project folder (`pwd`).
   Run `claude --continue` there, or close the tab and open the session again from the
   sidebar, to carry on.

### P3. Status on the deck

In the Ubuntu session, ask Claude to do something that takes a while (for example "count
the lines in every file here, one by one"). Watch the session's row on the deck (the
Muster section of the sidebar) and the tab: **Working** while it runs. Then ask for
something that needs permission (for example "create a file named musterdeck-test.txt"):
the row should show **Waiting** (it wants you). Answer it; when Claude finishes, the row
should read **Ready for review**. Take `p3-working.png`, `p3-waiting.png`, `p3-ready.png`.

### P4. Notifications

With the MusterDeck window in the background (click another app), ask Claude in the
Ubuntu session for another permission (for example "delete musterdeck-test.txt"). A
Windows notification should appear; clicking it should bring MusterDeck to that session.
Take `p4-notification.png` if they can catch it. `PASS` or `FAIL` by what they saw.

### P5. Restart MusterDeck and resume

Ask Claude something memorable ("remember the word pineapple"). Quit MusterDeck fully
(right-click its taskbar icon, Close window, then confirm quitting), open it again, and
open the Ubuntu session. It should come back on its own and continue the SAME
conversation: ask "what word did I ask you to remember?". Take `p5-resumed.png`. `PASS`
when it answers pineapple.

### P6. Drop a file and paste a screenshot

1. Drag a file from Explorer (the Desktop) onto the Ubuntu session's terminal. It should
   type a quoted Linux path like `'/mnt/c/Users/<them>/Desktop/file.txt'`, nothing
   uploaded. Record the exact text.
2. Take a screenshot with **Win+Shift+S**, then paste it into the Ubuntu session (Ctrl+V,
   or the screenshot button above the terminal). It should arrive as a Linux path too; ask
   Claude "describe that image". Take `p6-drop.png`.

### P7. Badges with mixed sessions

Open a second session, this time choosing **Windows** in the switch. Now the tabs and the
sidebar rows should carry small **UBUNTU** and **WINDOWS** badges. Take `p7-badges.png`.
Close the Windows session: the badges should disappear (every open session is in one
place again). `PASS` when both are true.

### P8. `wsl --shutdown` with a session open

(From PowerShell, never from inside WSL: see the top of this run.) With the Ubuntu session
open, run `wsl --shutdown`. Within a few seconds the Ubuntu tab should say
**Disconnected** with a **Restart** button. Take `p8-disconnected.png`. Click **Restart**:
it says **Starting Ubuntu...** while WSL boots, then the SAME conversation continues (ask
what word it remembers). Take `p8-restarted.png`.

### P9. Check environment

New Session, Ubuntu, folder `/home/<them>/does-not-exist-musterdeck`, Create. The tab
should say the folder is missing in Ubuntu, with **Check environment** and **Try again**.
Take `p9-missing.png`. Click **Check environment**: Settings > Environments should open.
Close that session afterwards.

### P10. The colour check

The question: does a session in MusterDeck draw the same colours as Windows Terminal?

1. In MusterDeck, open a **Windows** session with **Shell only** ticked (PowerShell) and
   run:

   ```powershell
   echo "TERM=$env:TERM COLORTERM=$env:COLORTERM"
   $e = [char]27; "$e[38;2;255;100;0mTRUECOLOR orange$e[0m $e[48;2;0;120;255m blue background $e[0m"
   -join (0..63 | ForEach-Object { "$e[48;2;$($_*4);$(255-$_*4);128m $e[0m" })
   ```

   Take `p10-windows-musterdeck.png`.
2. Open an **Ubuntu** session with **Shell only** ticked and run:

   ```bash
   echo "TERM=$TERM COLORTERM=$COLORTERM"
   printf '\033[38;2;255;100;0mTRUECOLOR orange\033[0m \033[48;2;0;120;255m blue background \033[0m\n'
   for i in $(seq 0 63); do printf "\033[48;2;$((i*4));$((255-i*4));128m \033[0m"; done; echo
   ```

   Take `p10-ubuntu-musterdeck.png`.
3. Run the same two blocks in **Windows Terminal** (a PowerShell tab and an Ubuntu tab).
   Put each Windows Terminal window beside the matching MusterDeck one and take
   `p10-windows-terminal.png` and `p10-ubuntu-terminal.png`.
4. Record the `TERM`/`COLORTERM` lines from all four (MusterDeck should print
   `xterm-256color` and `truecolor` in both of its sessions), and whether the orange, the
   blue and the smooth gradient look the same in MusterDeck as in Windows Terminal. A
   gradient drawn in a few flat bands, or plain grey text, is a `FAIL`. Then start `claude`
   in both MusterDeck shells and say whether Claude's own colours look like they do in
   Windows Terminal (`INFO`).

### P11. Removing the Primary

In Settings > Environments, Ubuntu is still the Primary (P1). Click **Remove** on Ubuntu:
the question should say Windows becomes Primary; confirm. A line should then say Ubuntu
was the Primary and Windows is Primary now. Take `p11-removed.png`. Then **Add Ubuntu**
again (the check runs again) so nothing is left half done.

## 5. Write it up and zip it

`findings.md` in the folder:

```markdown
# MusterDeck WSL checks, <date>

## Summary
| # | Check | Result | One line |
|---|---|---|---|
| 1 | WSL and networking | ... | ... |
...

## Machine
<build, wsl --version, distros, claude/node paths and versions, shell>

## 1. WSL and networking
<what was run, raw output, result>
... one section per check ...

## Screenshots
01-panel.png, 05-resize.png, ...
```

For the **phase 1b run**, the same shape with these rows in the summary, one section each,
and the colour check's four `TERM`/`COLORTERM` lines quoted exactly:

| # | Check |
|---|---|
| P1 | Setting Ubuntu up: prompt, Add, the rows, Sign in, Primary, folders |
| P2 | An Ubuntu Claude session from the dialog |
| P3 | Working, Waiting, Ready for review on the deck |
| P4 | Notifications |
| P5 | Restart MusterDeck and resume |
| P6 | Drop a file, paste a screenshot |
| P7 | Badges with mixed sessions |
| P8 | `wsl --shutdown`: Disconnected, Restart |
| P9 | Check environment |
| P10 | Colours, beside Windows Terminal |
| P11 | Removing the Primary |

Then the logs, into the same folder:
- every `[wsl]` line of `app.log` -> `wsl-lines.txt`;
- the last 300 lines of `app.log` -> `app-log-tail.txt`;
- the last 200 lines of `<dataDir>\debug\user-actions.log` -> `user-actions-tail.txt`
  (the phase 1b run: the last 600);
- the phase 1b run also copies `<dataDir>\CONFIG\environments.json` ->
  `environments.json` (it holds no secrets: environment names, folders and the Primary).

Zip it:

```powershell
Compress-Archive -Path "$out\*" -DestinationPath "$out.zip" -Force
```

Read `findings.md` back once; the zip must exist before step 6 starts.

## 6. Remove MusterDeck from this machine

Show the person this list, with the real paths, and ask for a yes before deleting anything.
Their own Claude Code setup is not touched, except files MusterDeck itself created there.

**Never follow a link while deleting.** A MusterDeck data folder (the real one AND the
throwaway `$dataDir`) holds account profiles whose homes mirror the person's REAL home:
every dot-folder of `%USERPROFILE%` (`.ssh`, `.vscode`, `.cursor`, ...) is a **junction**
into the real one. A delete that walks into a junction deletes the person's own files.
Windows PowerShell 5.1's `Remove-Item -Recurse` is such a delete: do not use it on these
folders. Use `cmd /c rmdir /s /q "<folder>"` (removes a junction, never its target) or the
Recycle Bin through the shell (`[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory`
with `SendToRecycleBin`), and afterwards check the person's `%USERPROFILE%\.*` folders still
hold what they held (seen on 2026-10-06: a .NET recursive delete stopped at a profile's
`.android` junction with access denied, harmlessly).

**Parity run first**: remove the throwaway data folder `$dataDir` (`%TEMP%\md-parity-*`)
without asking (this run made it, and the app under test kept everything there), and check
`fixtures.mjs --remove` left no `md-suite-*` folder in `%TEMP%` or in Ubuntu's home. Then
the list below, with its yes, as for any run.

1. Quit MusterDeck: `taskkill /IM MusterDeck.exe /F`.
2. Uninstall it: find `MusterDeck` under
   `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*` (or `HKLM:` for a
   machine-wide install) and run its `UninstallString` with `/S`.
3. MusterDeck's data: `$dataDir` (its sessions, configs, logs, account profiles),
   `%LOCALAPPDATA%\MusterDeck` (a dev build's data, if any), Electron's own folder
   `%APPDATA%\musterdeck`, and the updater's download cache
   `%LOCALAPPDATA%\musterdeck-updater` (it can hold hundreds of MB of installers).
4. Its registry keys: `HKCU\Software\Claude Command Center` and the older
   `HKCU\Software\Claude Conductor`.
5. Files it wrote into the Windows Claude folder, **matched by content, not only by name**
   (Claude Code keeps files with the same kind of names there, e.g. its own
   `mcp-needs-auth-cache.json`, which must stay):
   - `%USERPROFILE%\.claude\mcp-*.json` whose whole content is `{ "mcpServers": {...} }`
     (nothing else at the top level);
   - `%USERPROFILE%\.claude\settings-*.json` that contain MusterDeck's hook URL
     (`/hook/` on `localhost` or `127.0.0.1`);
   - the skill folders under `%USERPROFILE%\.claude\skills\` that carry a `.ccc-bundled`
     file (installed by MusterDeck; a folder without it is the person's own and stays).
   List any `mcp-*.json` or `settings-*.json` that did NOT match, and leave them.
6. The same in Ubuntu, by the same content rules: `~/.claude/settings-*.json`,
   `~/.claude/mcp-*.json`, plus `~/.claude/launch-*.sh`,
   `~/.claude/conductor-ssh-statusline.js`, and the skill folders under `~/.claude/skills/`
   that carry a `.ccc-bundled` file (MusterDeck installs its skills in Ubuntu at the first
   Ubuntu Claude launch, even in a parity run, because Ubuntu's `~/.claude` is not the
   throwaway folder). Then `~/.musterdeck`, **said separately**: it holds
   `claude-config-backups/initial.tar`, the only copy of their Ubuntu Claude config from
   before MusterDeck first wrote to it, plus pinned Claude versions, Codex launch files and
   any account added in Ubuntu. Offer to keep the backup (move it to their home) before
   removing the rest.
7. The installer it downloaded: `MusterDeck-*.exe` in Downloads.
8. If `%USERPROFILE%\.wslconfig` has a `.musterdeck-*.bak` beside it, MusterDeck changed
   it: show both and ask before restoring the backup.
9. Last, and only if they want: the musterdeck plugin itself
   (`/plugin uninstall musterdeck@musterdeck`). This skill lives in it, so say so first.

Then check each path is gone and say what was removed. Anything that could not be removed
(a file in use), say plainly.

## 7. Hand back

Tell them, in two lines: the zip's full path, and to send it to Filipe as a reply in the
Slack thread where he asked. Thank them.
