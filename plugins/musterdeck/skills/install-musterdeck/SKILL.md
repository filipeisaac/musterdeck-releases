---
name: install-musterdeck
description: Download and install the latest MusterDeck release for this machine - the macOS .dmg or the Windows .exe - from the public releases repository, verify it, put it in place and launch it, then offer Remote access (one MusterDeck driving another's sessions, with help installing and setting up Tailscale) and the custom Crew themes. Also installs a named preview build when given its tag (e.g. /install-musterdeck v1.0.39-wsl-preview), and works from Claude Code running inside WSL on Windows. Use when asked to install, reinstall, update or upgrade MusterDeck, to install a preview or test build, or to get MusterDeck onto a new machine.
---

# Installing MusterDeck

Works out which OS it is on, fetches the newest published release, checks it, installs it,
and offers Remote access and the custom Crew themes afterwards.

**Do only the section for the OS you are on.** `uname -s` gives `Darwin` on macOS; on
Windows `$env:OS` is `Windows_NT`. **Inside WSL** (`uname -s` is `Linux` and
`/proc/version` mentions `microsoft`), the machine is Windows: install the Windows build
from there, as *3c* says. A Linux machine that is not WSL has no build.

This installs a **released build**. It does not build anything and does not need the source
repository; see `publish-musterdeck` for producing a release in the first place.

It reaches you as a Claude Code plugin rather than with the app, deliberately: a skill whose
job is to install something cannot be delivered by the thing it installs. If you are reading
this, someone ran

```
/plugin marketplace add filipeisaac/musterdeck-releases
/plugin install musterdeck@musterdeck
```

which needs nothing on the machine but Claude Code. The same plugin is how upgrades happen
later, so there is one copy of these instructions and it is never out of reach.

---

## 1. What is published, and what this machine needs

Installers live on the **public** repository `filipeisaac/musterdeck-releases`. Public
means no sign-in: read it with plain HTTP and do not require the GitHub CLI here.

```bash
curl -sS -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/filipeisaac/musterdeck-releases/releases/latest
```

Take `tag_name` as the version and find the asset for this machine:

| OS | Asset | Only supports |
| --- | --- | --- |
| macOS | `MusterDeck-<version>-mac.dmg` | **Apple Silicon (arm64)** |
| Windows | `MusterDeck-<version>.exe` | **x64** |

`latest-mac.yml`, `latest.yml` and the `.blockmap` files are for the app's own updater.
Do not download them.

**Check the architecture before downloading.** `uname -m` must be `arm64` on macOS; an
Intel Mac has no build and there is nothing to install: say so rather than handing over a
DMG that will not open. On Windows, `$env:PROCESSOR_ARCHITECTURE` should be `AMD64`.

### A named preview build

Ubuntu (WSL) support is in the regular releases since 1.0.107, so the newest release is what
almost everyone wants; the `*-wsl-preview` pre-releases are old test builds. When the user
names a tag (`/install-musterdeck v1.0.39-wsl-preview`, or "install the WSL
preview"), install THAT release instead of the newest:

```bash
curl -sS -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/filipeisaac/musterdeck-releases/releases/tags/v1.0.39-wsl-preview
```

Its asset is `MusterDeck-<tag without the v>.exe` (or `-mac.dmg`), checked against the
release's `CHECKSUMS.txt` like any other. Say plainly what a preview is: a test build, marked
as a pre-release, that the app's own updater never offers to anyone. To go back, run
`/install-musterdeck` with no tag, which installs the newest normal release over it; the
data directory is kept either way. If the named tag does not exist, list the pre-releases
on the repository rather than guessing.

**If the asset for this OS is missing from the newest release**, say so plainly. A release
is built one platform per machine, so the other platform's installer sometimes lands later.
Check older releases before concluding there is nothing to install.

### Already installed?

```bash
# macOS
defaults read /Applications/MusterDeck.app/Contents/Info.plist CFBundleShortVersionString
```
```powershell
# Windows -- the default per-user location; the installer lets people choose
# another, so fall back to Settings > Apps if this path does not exist.
(Get-Item "$env:LOCALAPPDATA\Programs\MusterDeck\MusterDeck.exe").VersionInfo.ProductVersion
```

If it already matches the latest release, say so and stop, unless the user asked for a
reinstall. **Upgrading never touches the user's data**: sessions, saved configs and themes
live in the data directory, not in the app bundle.

| OS | Data directory (kept across upgrades) |
| --- | --- |
| macOS | `~/Library/Application Support/Claude Conductor` |
| Windows | `%LOCALAPPDATA%\MusterDeck` |

Those names are two products old and are deliberately not changed: renaming them orphans
the user's data.

## 2. Download and verify

Download the installer and `CHECKSUMS.txt` from the release, then check the hash. Do not
skip this; a truncated 200 MB download otherwise fails much later and much less clearly.

```bash
# macOS / Git Bash
shasum -a 256 "MusterDeck-<version>-mac.dmg"
grep "MusterDeck-<version>-mac.dmg" CHECKSUMS.txt
```
```powershell
# Windows
(Get-FileHash .\MusterDeck-<version>.exe -Algorithm SHA256).Hash.ToLower()
Select-String -Path .\CHECKSUMS.txt -Pattern "MusterDeck-<version>.exe"
```

The two must match. If they do not, delete the file and download again; never install it.

---

## 3a. macOS: install

**Never quit or kill MusterDeck yourself.** Quitting it asks whether to save the open sessions,
and a forced quit skips that question, so they would not come back. And this skill may be
running INSIDE a MusterDeck session (`CLAUDE_MULTI_SESSION_ID` is set): quitting MusterDeck
ends this very session, and an install that waits for the next command never happens.

So the install runs on its own, in the background: it waits until MusterDeck has quit, puts the
new app in place, and opens it. Start it with the DMG's absolute path:

```bash
DMG="$PWD/MusterDeck-<version>-mac.dmg"
LOG="$HOME/Library/Logs/musterdeck-install.log"
cat > "$TMPDIR/musterdeck-install.sh" <<'EOF'
DMG="$1"; APP="${2:-/Applications/MusterDeck.app}"; LAUNCH="${3:-open}"
echo "waiting for MusterDeck to quit"
i=0; while ps -axo comm= | grep -Fqx "$APP/Contents/MacOS/MusterDeck"; do i=$((i+1)); [ $i -gt 1800 ] && { echo "MusterDeck still running after 30 minutes; nothing installed"; exit 1; }; sleep 1; done
MNT=$(hdiutil attach "$DMG" -nobrowse -readonly -plist | grep -A1 '<key>mount-point</key>' | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
[ -d "$MNT/MusterDeck.app" ] || { echo "could not open $DMG; nothing installed"; exit 1; }
rm -rf "$APP.new" "$APP.old"
ditto "$MNT/MusterDeck.app" "$APP.new" || { rm -rf "$APP.new"; echo "copy failed; opening the DMG to drag by hand"; open "$MNT"; exit 1; }
[ -d "$APP" ] && { mv "$APP" "$APP.old" || { rm -rf "$APP.new"; echo "could not move the old app aside; opening the DMG"; open "$MNT"; exit 1; }; }
mv "$APP.new" "$APP" || { mv "$APP.old" "$APP"; echo "could not put the new app in place; opening the DMG"; open "$MNT"; exit 1; }
rm -rf "$APP.old"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null
hdiutil detach "$MNT" -quiet || hdiutil detach "$MNT" -force -quiet
echo "installed $(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)"
[ "$LAUNCH" = open ] && open "$APP"
exit 0
EOF
nohup /bin/sh "$TMPDIR/musterdeck-install.sh" "$DMG" > "$LOG" 2>&1 &
```

Then, if MusterDeck is running, **tell the user to quit it themselves: Cmd+Q, then Save
Sessions.** It reopens on the new version by itself within a few seconds, with the sessions
saved. When this skill runs inside MusterDeck, say first that this session closes with it and
the install carries on alone; once MusterDeck is back they can ask in any session to check it.
If MusterDeck was not running, the install starts at once.

Check it in `$LOG`: the last line is `installed <version>`. Anything else says what happened;
when the copy could not be made it opens the DMG in Finder, for a drag into Applications by hand.

Why it is written this way: it waits on the app's own executable path, read with `ps` (`pgrep -f`
missed the running app's main process on macOS 27); it copies beside the old app and swaps them
by two renames, putting the old one back if the second fails, so there is never a moment with no
MusterDeck in Applications. Use `ditto`, not `cp -R`: it preserves the bundle faithfully,
including symlinks inside the framework, which a plain copy can mangle.

### The quarantine flag

The script clears it (`xattr -dr com.apple.quarantine`). The build is **not signed with an Apple Developer ID**, so Gatekeeper would otherwise
refuse it as "from an unidentified developer" and the user would have to right-click → Open.
Removing the quarantine attribute that the download added avoids that entirely.

Use `-dr com.apple.quarantine`, not `xattr -cr`. `-cr` strips *every* extended attribute,
which is only wanted when something is about to be re-signed. Nothing is re-signed here:
the app inside the DMG already carries its own ad-hoc signature, and that signature is what
makes notifications work: macOS keys an app in Notification Center by its code-signing
identity. Confirm it survived the copy:

```bash
codesign -dv "/Applications/MusterDeck.app" 2>&1 | grep -E 'Identifier|Sealed'
```

Expect `Identifier=com.musterdeck.app` and `Sealed Resources version=2`. If it says
`Identifier=Electron`, the app will run but **every notification it posts will silently go
nowhere**. That is a broken installer, not something to fix here; report it.

### Launch

The script opens it. If macOS opens the *old* version, LaunchServices has cached the replaced bundle. Re-register
it and try again:

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "/Applications/MusterDeck.app"
```

On first launch macOS may ask for access to Documents, Desktop or Downloads. The app needs
it to read the project folders sessions run in; the request is expected, and the first
launch can sit waiting on that dialog, so tell the user to look for it.

After an UPDATE (not a first install), macOS may also ask once whether MusterDeck may use
"MusterDeck Safe Storage" in the keychain. Each release carries a new ad-hoc signature, so
macOS asks again for the item the previous build created (it holds saved SSH passwords and
encrypted notes). Tell the user to click **Always Allow**; Deny only means MusterDeck asks
for those passwords again. Since 1.0.120 a session that signs in with an SSH key never
touches the keychain, so it cannot hang on this prompt.

---

## 3b. Windows: install

**A running copy is closed by the user, never killed**: ask them to close MusterDeck and
choose Save Sessions, or the open sessions do not come back. If this skill runs inside a
MusterDeck session (`CLAUDE_MULTI_SESSION_ID` is set), closing MusterDeck ends this session
too: ask them to run the install from Claude Code in a terminal instead. Then run the installer:

```powershell
.\MusterDeck-<version>.exe
```

It is a normal wizard: it asks where to install and offers desktop and Start-menu
shortcuts. For an unattended install:

```powershell
.\MusterDeck-<version>.exe /S
```

The installer is **not signed**, so SmartScreen may say "unrecognised publisher". The user
clicks **More info → Run anyway**. Say this before they hit it rather than after.

**Smart App Control** (Windows Security > App & browser control; on by default on many new
Windows 11 PCs) judges unsigned files by reputation, and MusterDeck's native modules are
unsigned. A new release's database module can be one it has not seen yet, and Windows may then
say that **parts of the app were blocked**. 1.0.195 installed and ran with it on, on a fresh
PC. If it does happen: what was blocked is in Event Viewer > Applications and Services Logs >
Microsoft > Windows > CodeIntegrity > Operational (event 3077), and it usually clears once
Windows has judged the file. Never suggest turning Smart App Control off: it cannot be turned
back on without reinstalling Windows.

Installing over an existing copy upgrades in place and keeps the data directory.

**Launch it through Explorer**, not as a child of this shell:

```powershell
Start-Process explorer.exe "$env:LOCALAPPDATA\Programs\MusterDeck\MusterDeck.exe"
```

You are running inside a Claude Code session, and a process started from here inherits that
session's environment, including the signed-in account (`CLAUDE_CODE_USER_EMAIL`,
`CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_ORGANIZATION_UUID`) and the host's own channel.
Before 1.0.143 MusterDeck passed those on, Claude Code wrote them into every new account
profile, and **Add another account** was refused as the first account two seconds in.
Started by Explorer, the app gets the user's own environment, as from the Start menu. 1.0.143
and later strip them anyway; launching through Explorer keeps older builds right too.

## 3c. Windows, from inside WSL

Claude Code may be running in Ubuntu on the Windows machine that should get MusterDeck.
Windows' own tools are reachable from there (WSL interop), so install the Windows build
without leaving WSL:

```bash
WINUSER=$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')
DL="/mnt/c/Users/$WINUSER/Downloads"
curl -fL -o "$DL/MusterDeck-<version>.exe" "<the asset's browser_download_url>"
sha256sum "$DL/MusterDeck-<version>.exe"      # compare with CHECKSUMS.txt, as in step 2
taskkill.exe /IM MusterDeck.exe /F 2>/dev/null
cmd.exe /c start "" "C:\Users\$WINUSER\Downloads\MusterDeck-<version>.exe"
```

The wizard and the SmartScreen warning are the same as in *3b*: say so before it appears.
If `cmd.exe` is not found, interop is off in this distro: give the user the download link
and the hash and let them run the installer from Windows.

---

## 4. First launch matters

Let the app start once before doing anything else. On boot it installs the skills it ships
with into `~/.claude/skills/`, which is where the theme skill in the next step comes from,
so **step 6 does not work until the app has run at least once**, and it creates the data
directory if this is a first install.

(That is the right way round: the theme skill needs a data directory to write into and a
running Crew to reload, so it genuinely has nothing to do before the app exists. This skill
is the one that had to come from somewhere else.)

If this is a brand-new install it opens a setup flow: where the user works, which Claude
install to use, and which optional features to switch on. Leave that to them.

Its **Find Claude** step fixes what it finds on the same screen (1.0.134): each fix shows its
command in full beside the button that runs it, runs it in a small terminal there, and checks
the row again when it is done. So nothing has to be installed before MusterDeck but the app:

- **Claude Code missing** (on this computer, or in Ubuntu): **Install it for me** runs Claude
  Code's own installer. On Windows that is PowerShell; press **Check again** when it says it
  is installed. No restart is needed.
- **Not signed in**: **Sign in now** (this computer) or **Sign in to Claude in Ubuntu** runs
  Claude's own login there. Its sign-in link gets **Open the sign-in page** and **Copy link**
  buttons, and the code from the browser pastes back with Ctrl+V or a right-click. On this
  computer it runs `claude auth login` and closes by itself once signed in (1.0.154); in
  Ubuntu, type `/exit` when it says you are signed in. Since 1.0.154 the row asks Claude itself
  (`claude auth status`), so an expired sign-in shows as "Not signed in" even when Claude's
  config still names the account; a row that says it couldn't check is not a sign-in.
- **After updating MusterDeck**, it opens on your sessions ("Resume previous sessions?"), not
  on setup's "Where do you work?" (builds before 1.0.154 sent Windows users back through
  first-run setup on every update).
- **The status line needs Node in Ubuntu**: optional (Ubuntu sessions work without it).
  **Install Node for me** installs it with nvm, no password needed.
- **Codex not signed in, in Ubuntu**: **Sign in to Codex** runs `codex login` there.
- **Ubuntu not answering**: **Open Ubuntu here** starts it on the screen, so its first-run
  questions (create a user) can be answered there.
- **WSL is on NAT networking**: the **Switch** button sets mirrored networking, which
  MusterDeck needs to see what Claude is doing in Ubuntu. It restarts WSL, so ask first if
  they have work running in Ubuntu.
- What no button can fix (WSL not installed; Ubuntu unable to reach MusterDeck's folder for
  the status line) gets numbered steps and **Check again**.

On Windows 11 with Ubuntu in WSL, the Ubuntu rows appear only after the step's **Check
Ubuntu**, which shows every command it will run first.

The **compatibility check** that follows offers **Update Claude Code** when a Claude Code is
older than MusterDeck is validated against (1.0.145): Claude Code's own `claude update`, on
this computer or in Ubuntu, shown in full before the button runs it, then Check again. No
restart.

**Notifications on Windows.** Setup's notifications page sends a test and says what Windows
answered (1.0.144). Windows has no permission prompt; it decides by itself whether a
notification is SHOWN, and it shows them only for an app it lists as installed. If nothing
pops up:

- Do not disturb must be off (Win+N), and MusterDeck switched on under Settings > System >
  Notifications (the page has a button for that).
- Windows must list MusterDeck as an app. Check:
  ```powershell
  Get-StartApps | Where-Object { $_.AppID -eq 'com.musterdeck.app' }
  ```
  Nothing listed means Windows has not taken in the Start-menu entry yet, and it stores
  MusterDeck's notifications without showing any. Signing out and back in usually gets it to
  read the Start menu again. A build before 1.0.144 posted under another ID (`electron.app.MusterDeck`)
  and rewrote the shortcut to it; installing 1.0.144 or later puts the installer's ID back.
- `app.log` in the data directory records each test: `[notify] test blocked: shown`, or
  `failed` with Windows' reason.

Help with any of these if asked; otherwise leave setup to them.

## 5. Offer Remote access, and Tailscale

Since 1.0.340 one MusterDeck can drive another's sessions: a desk machine's sessions show in
the laptop's sidebar and deck, typing there runs on the desk, and right-click actions happen
there. It needs MusterDeck 1.0.340 or later on BOTH machines (the same version is best), and
it is off until the person turns it on. Nothing listens beyond the machine until then, and
only machines paired by a six-digit code get in.

**Ask** with AskUserQuestion: *Do you want to use Remote access, driving this machine's
sessions from another computer (or another computer's from this one)?*

| Option | What it means |
|---|---|
| **Yes, across networks with Tailscale** (Recommended when the machines are not always on one network) | Tailscale below, then the pairing |
| **Yes, on this network only** | both machines on the same Wi-Fi or LAN; skip to *Pair the machines* |
| **Not now** | say it is in Configs > Remote access whenever they want it, and go on to step 6 |

### Tailscale: install it, sign in, check it

Tailscale puts the person's machines on one private network wherever they are. MusterDeck
uses only the machine's own Tailscale address. **It does not need** MagicDNS or "Use
Tailscale DNS" (leave them off if a VPN conflicts with them), HTTPS certificates, or
`tailscale serve`: do not change any of those for MusterDeck. Do this on **each** machine.

1. **Already there?**
   ```bash
   # macOS
   TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale; [ -x "$TS" ] || TS=$(command -v tailscale)
   "$TS" version && "$TS" status
   ```
   ```powershell
   # Windows (from WSL too: run it through powershell.exe; Tailscale goes on WINDOWS, not in Ubuntu)
   & "$env:ProgramFiles\Tailscale\tailscale.exe" version; & "$env:ProgramFiles\Tailscale\tailscale.exe" status
   ```
   Running and signed in: skip to step 4.
2. **Install**, asking first:
   - **Windows**: `winget install --id Tailscale.Tailscale -e`. The installer asks for
     administrator rights; the person accepts it.
   - **macOS**: the person installs it, because macOS asks them to approve its network
     extension: from the Mac App Store, or the standalone download at
     https://tailscale.com/download/mac. Open the page for them (`open <url>`) and wait. Then
     open Tailscale and allow its VPN configuration when macOS asks.
3. **Sign in**: open Tailscale (menu bar on macOS, the tray on Windows) and Log in, or run
   `tailscale up` (the CLI path from step 1), which prints a link to open. **Every machine
   signs in to the same tailnet** (the same account, or one invited to it). Leave the sign-in
   to the person.
4. **Check**: `tailscale status` lists both machines, and `tailscale ip -4` gives this one's
   `100.x.y.z` address. The other machine must show in the list before pairing; if it does
   not, it is signed in to another tailnet.

### Pair the machines

Leave the clicking to the person; say it in these words:

1. On the machine to be **driven**: Configs > Remote access, turn it on, then
   **Make discoverable** (ten minutes). With Tailscale, its tailnet address shows there.
2. On the machine that **drives**: same page, **Find machines**. It lists the other one on
   this network and over Tailscale; otherwise type its address.
3. **Pair**: both screens show the same six digits; confirm on the driven machine.
4. Its sessions appear in their own section of the sidebar. **Revoke** on the driven machine
   cuts a machine off at once.

If the OS asks: on macOS, allow MusterDeck to find devices on the local network and to
accept incoming connections; on Windows, allow MusterDeck through the firewall on private
networks. Without that, Find comes back empty and pairing times out.

## 6. Offer the custom Crew themes

MusterDeck ships with two Crew themes, Harbour and the Samurai Village. Others, the Jedi
Enclave and the Galley Kitchen, are distributed separately because they carry someone
else's IP or branding.

Once the app has started, **offer to add them**, and if the user says yes, use the
**`musterdeck-install-custom-theme`** skill. Do not reimplement it here: it checks what is
published against what this machine already has, verifies each download, backs up anything
it replaces, and refuses a theme this app version is too old to load.

Two things worth saying as you offer:

- Nothing to sign in to: that repository is public too, so the theme skill reads it over
  plain HTTP. Do not send anyone to `gh auth login` for this.
- Themes are runtime data: adding one needs no rebuild and no restart, only **Reload
  themes** in the Crew's view menu.

If the user declines, say the offer stands whenever they want it, and finish.

## 7. Say what happened

State the version installed, where it went, whether Remote access was set up (Tailscale
installed and signed in on which machines, paired or not), and whether themes were added. If anything was
skipped (an Intel Mac, a missing asset for this platform, a declined theme step), say that
too rather than reporting a clean run.
