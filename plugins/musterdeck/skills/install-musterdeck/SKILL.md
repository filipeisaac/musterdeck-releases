---
name: install-musterdeck
description: Download and install the latest MusterDeck release for this machine - the macOS .dmg or the Windows .exe - from the public releases repository, verify it, put it in place and launch it, then offer to add the custom Crew themes. Also installs a named preview build when given its tag (e.g. /install-musterdeck v1.0.39-wsl-preview), and works from Claude Code running inside WSL on Windows. Use when asked to install, reinstall, update or upgrade MusterDeck, to install a preview or test build, or to get MusterDeck onto a new machine.
---

# Installing MusterDeck

Works out which OS it is on, fetches the newest published release, checks it, installs it,
and offers the custom Crew themes afterwards.

**Do only the section for the OS you are on.** `uname -s` gives `Darwin` on macOS; on
Windows `$env:OS` is `Windows_NT`. **Inside WSL** (`uname -s` is `Linux` and
`/proc/version` mentions `microsoft`), the machine is Windows: install the Windows build
from there, as *3c* says. A Linux machine that is not WSL has no build.

This installs a **released build**. It does not build anything and does not need the source
repository — see `publish-musterdeck` for producing a release in the first place.

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
Intel Mac has no build and there is nothing to install — say so rather than handing over a
DMG that will not open. On Windows, `$env:PROCESSOR_ARCHITECTURE` should be `AMD64`.

### A named preview build

When the user names a tag (`/install-musterdeck v1.0.39-wsl-preview`, or "install the WSL
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

If it already matches the latest release, say so and stop — unless the user asked for a
reinstall. **Upgrading never touches the user's data**: sessions, saved configs and themes
live in the data directory, not in the app bundle.

| OS | Data directory (kept across upgrades) |
| --- | --- |
| macOS | `~/Library/Application Support/Claude Conductor` |
| Windows | `%LOCALAPPDATA%\Claude Command Center` |

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

## 3a. macOS — install

**Quit a running copy first.** Replacing the bundle under a live process is how you get a
half-updated app.

```bash
osascript -e 'tell application "MusterDeck" to quit' 2>/dev/null; sleep 3
pkill -f "/Applications/MusterDeck.app" 2>/dev/null
```

Mount, copy with `ditto`, unmount:

```bash
hdiutil attach "MusterDeck-<version>-mac.dmg" -nobrowse -readonly
rm -rf "/Applications/MusterDeck.app"
ditto "/Volumes/MusterDeck <version>-arm64/MusterDeck.app" "/Applications/MusterDeck.app"
hdiutil detach "/Volumes/MusterDeck <version>-arm64" -quiet
```

Use `ditto`, not `cp -R`: it preserves the bundle faithfully, including symlinks inside the
framework, which a plain copy can mangle.

### Clear the quarantine flag

```bash
xattr -dr com.apple.quarantine "/Applications/MusterDeck.app"
```

The build is **not signed with an Apple Developer ID**, so Gatekeeper would otherwise
refuse it as "from an unidentified developer" and the user would have to right-click → Open.
Removing the quarantine attribute that the download added avoids that entirely.

Use `-dr com.apple.quarantine`, not `xattr -cr`. `-cr` strips *every* extended attribute,
which is only wanted when something is about to be re-signed. Nothing is re-signed here:
the app inside the DMG already carries its own ad-hoc signature, and that signature is what
makes notifications work — macOS keys an app in Notification Center by its code-signing
identity. Confirm it survived the copy:

```bash
codesign -dv "/Applications/MusterDeck.app" 2>&1 | grep -E 'Identifier|Sealed'
```

Expect `Identifier=com.musterdeck.app` and `Sealed Resources version=2`. If it says
`Identifier=Electron`, the app will run but **every notification it posts will silently go
nowhere** — that is a broken installer, not something to fix here; report it.

### Launch

```bash
open "/Applications/MusterDeck.app"
```

If macOS opens the *old* version, LaunchServices has cached the replaced bundle. Re-register
it and try again:

```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "/Applications/MusterDeck.app"
```

On first launch macOS may ask for access to Documents, Desktop or Downloads. The app needs
it to read the project folders sessions run in; the request is expected, and the first
launch can sit waiting on that dialog, so tell the user to look for it.

---

## 3b. Windows — install

**Close a running copy first**, then run the installer:

```powershell
Get-Process MusterDeck -ErrorAction SilentlyContinue | Stop-Process
.\MusterDeck-<version>.exe
```

It is a normal wizard: it asks where to install and offers desktop and Start-menu
shortcuts. For an unattended install:

```powershell
.\MusterDeck-<version>.exe /S
```

The installer is **not signed**, so SmartScreen may say "unrecognised publisher". The user
clicks **More info → Run anyway**. Say this before they hit it rather than after.

Installing over an existing copy upgrades in place and keeps the data directory.

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
with into `~/.claude/skills/` — which is where the theme skill in the next step comes from,
so **step 5 does not work until the app has run at least once** — and it creates the data
directory if this is a first install.

(That is the right way round: the theme skill needs a data directory to write into and a
running Crew to reload, so it genuinely has nothing to do before the app exists. This skill
is the one that had to come from somewhere else.)

If this is a brand-new install it opens a setup flow: where the user works, which Claude
install to use, and which optional features to switch on. Leave that to them.

## 5. Offer the custom Crew themes

MusterDeck ships with two Crew themes, Harbour and the Samurai Village. Others — the Jedi
Enclave and the Galley Kitchen — are distributed separately because they carry someone
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

## 6. Say what happened

State the version installed, where it went, and whether themes were added. If anything was
skipped — an Intel Mac, a missing asset for this platform, a declined theme step — say that
too rather than reporting a clean run.
