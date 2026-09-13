# MusterDeck

**Run many Claude Code sessions at once, and see which ones need you.**

This repository holds the downloads. The source is private; nothing here but installers
and release notes.

## Download

Grab the latest installer from [**Releases**](../../releases/latest).

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `MusterDeck-<version>-mac.dmg` |
| Windows (x64) | `MusterDeck-Setup-<version>.exe` |

Every release carries a `CHECKSUMS.txt` with SHA-256 sums for each asset.

### macOS: the first launch

The app is not notarized by Apple, so Gatekeeper will refuse it the first time. Open it
once from the right-click menu and macOS remembers the decision:

1. **Right-click** MusterDeck in Applications, choose **Open**
2. Click **Open** again in the dialog

Double-clicking normally works from then on. If you prefer the terminal:

```bash
xattr -dr com.apple.quarantine /Applications/MusterDeck.app
```

## What it is

MusterDeck is a desktop app for running many Claude Code sessions at once: a terminal
multiplexer with an orchestration layer. Every session is a real shell process with its
own working directory, transcript and status, and the app watches all of them.

The problem it exists to solve is attention. When twenty agents are working, what you
need to know is not what each one is doing, it is **which ones are waiting on you**.

- **A muster line** collects exactly the sessions that want you — blocked first, then
  waiting, then finished-but-unseen, and inside each the longest wait first. Your own
  session list never reorders itself.
- **A count on the dock**, and a dock menu listing what wants you, so you know without
  the app being on screen.
- **Notifications you can aim**: per kind, muted per session, and always subject to Do
  Not Disturb.
- **A 3D map** of every repository and session, so a glance tells you where attention is
  needed without reading anything.

## Updates

MusterDeck checks this repository for new releases and can install them for you. The
check is anonymous — no account and no `gh` CLI needed.

## Themes

The map's look is data, not code: one JSON file, re-read without a rebuild. Themes that
do not ship in the app live in a separate repository.

## Reporting something

Open an [issue](../../issues). Include the version from the status bar.
