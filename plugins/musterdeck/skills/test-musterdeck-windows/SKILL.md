---
name: test-musterdeck-windows
description: Run MusterDeck's WSL preview checks on a Windows 11 machine with Ubuntu in WSL - install the preview build, run the eight checks (automating what it can, guiding the person through the rest), write a findings report with screenshots and logs into one zip on the Desktop to send back, then remove every trace of MusterDeck from the machine. Use when asked to test MusterDeck on Windows, run the WSL checks, run /test-musterdeck-windows, or "do the MusterDeck test Filipe asked for".
---

# Testing MusterDeck on Windows (the WSL preview checks)

Filipe is building Claude sessions that run inside Ubuntu (WSL) for MusterDeck. Before
that is built, eight things only a real Windows 11 machine with Ubuntu can answer have to
be measured. This skill measures them on THIS machine, writes them up, and cleans up
afterwards. The person running it is helping, so be quick, plain and kind: say what each
step is for in one line, never make them read the procedure.

**What it does, in order:** check the machine; install the preview build; run the checks;
write `findings.md` with screenshots and logs and zip it on the Desktop; remove MusterDeck
and its data (after confirming); say where the zip is and to send it to Filipe.

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

## 2. Install the preview

Is MusterDeck already installed, and does the person use it for real work? Ask. If they
do, say plainly that step 6 will remove it and its data at the end, and get a yes before
going on (they can also stop here).

Then install the preview with the **`install-musterdeck`** skill, naming its tag:
`v1.0.39-wsl-preview`. It downloads, verifies and runs the installer. Ask the person to
open MusterDeck and confirm the status bar reads `CLI v1.0.39`.

## 3. The panel

Ask the person to open **Settings > General > WSL (preview)**, click **Check Ubuntu**,
read the list of commands it will run, then click **Run the check**. When the answers
show, take screenshot `01-panel.png`. Then ask them to click **Open Ubuntu terminal**
and leave that tab open.

## 4. The eight checks

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

Then the logs, into the same folder:
- every `[wsl]` line of `app.log` -> `wsl-lines.txt`;
- the last 300 lines of `app.log` -> `app-log-tail.txt`;
- the last 200 lines of `<dataDir>\debug\user-actions.log` -> `user-actions-tail.txt`.

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
