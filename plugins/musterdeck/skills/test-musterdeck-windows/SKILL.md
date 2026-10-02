---
name: test-musterdeck-windows
description: Run MusterDeck's WSL test on a Windows 11 machine with Ubuntu in WSL - install the private build, run a guided pass (by default the phase 1b run - Ubuntu set up in Settings > Environments, Ubuntu Claude sessions with status, notifications, resume, drops, badges, wsl --shutdown, and a colour check; or, with `spike`, the original eight checks), write a findings report with screenshots and logs into one zip on the Desktop to send back, then remove every trace of MusterDeck from the machine. Use when asked to test MusterDeck on Windows, run the WSL checks or the phase 1b test, run /test-musterdeck-windows, or "do the MusterDeck test Filipe asked for".
---

# Testing MusterDeck on Windows (the WSL test)

Filipe is building Claude sessions that run inside Ubuntu (WSL) for MusterDeck. Some of it
can only be checked on a real Windows 11 machine with Ubuntu. This skill runs those checks
on THIS machine, writes them up, and cleans up afterwards. The person running it is
helping, so be quick, plain and kind: say what each step is for in one line, never make
them read the procedure.

## Which run

`/test-musterdeck-windows [phase-1b | spike]`. **With no argument, run the newest:
`phase-1b`.**

| Run | Build (tag) | What it covers | Steps |
|---|---|---|---|
| `phase-1b` | `v1.0.58-wsl-preview` (status bar `CLI v1.0.58`), unless Filipe named another | the whole Ubuntu experience: setting Ubuntu up, Ubuntu Claude sessions, status, notifications, resume, drops, badges, `wsl --shutdown`, and a colour check | 0, 1, 2, then P1 to P11, then 5 to 7 |
| `spike` | `v1.0.39-wsl-preview` (`CLI v1.0.39`) | the eight measurements taken before anything was built | 0, 1, 2, 3, 4, then 5 to 7 |

If Filipe's message names a different tag, use his. Say which run this is in the first
line of `findings.md`.

**What it does, in order:** check the machine; install the build; run the checks of the
chosen run; write `findings.md` with screenshots and logs and zip it on the Desktop;
remove MusterDeck and its data (after confirming); say where the zip is and to send it to
Filipe.

**What it never does:** send anything anywhere (the person sends the zip themselves);
touch their own Claude Code setup beyond the files MusterDeck itself created; delete
anything before the zip exists and they have said yes.

## Where this is running

Claude Code may be running on Windows (PowerShell) or inside Ubuntu (WSL). Both work.

- **On Windows**: run the Windows commands below as they are, and reach Ubuntu with
  `wsl -d <distro> -- bash -lc '<command>'`.
- **Inside WSL** (`uname -s` is `Linux` and `/proc/version` mentions `microsoft`): run the
  Ubuntu commands directly, and the Windows ones through
  `powershell.exe -NoProfile -Command '<command>'`. Windows paths are under `/mnt/c/`.

Set `$env:WSL_UTF8 = "1"` (or `WSL_UTF8=1`) before any `wsl.exe` call so its output is
readable text instead of UTF-16.

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
   `~/.claude/conductor-ssh-statusline.js` and `~/.musterdeck`.
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
