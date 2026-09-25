# MusterDeck

**Run many Claude Code sessions at once, and see which ones need you.**

This repository holds the downloads. The source is private; nothing here but installers
and release notes.

## Install

### The plugin (recommended)

MusterDeck installs itself through a Claude Code plugin. Nothing needs to be on the
machine but Claude Code:

```
/plugin marketplace add filipeisaac/musterdeck-releases
/plugin install musterdeck@musterdeck
/install-musterdeck
```

`/install-musterdeck` works out your OS and architecture, downloads the right installer
from the latest release, checks it against the published SHA-256, installs it, launches
it, and offers to add the extra Crew themes. Run it again whenever you want to upgrade.

The plugin also brings the rest of the skills with it:

| Skill | What it does |
|---|---|
| `install-musterdeck` | Install or upgrade the app, as above |
| `musterdeck-install-custom-theme` | Add the Crew themes that do not ship with the app |
| `new-crew-theme` | Build a Crew theme of your own, end to end |

### Downloading it yourself

If you would rather not add a marketplace, take the installer straight from
[**Releases**](../../releases/latest):

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `MusterDeck-<version>-mac.dmg` |
| Windows (x64) | `MusterDeck-<version>.exe` |

Every release carries a `CHECKSUMS.txt` with SHA-256 sums for each asset.

**You still get the skills.** The app installs the same three into `~/.claude/skills/` the
first time it starts, so nothing is lost by skipping the plugin — you just install and
upgrade the app by hand instead of with `/install-musterdeck`. They are the same files
either way, and the app never overwrites one you have edited.

### macOS: the first launch

The app is not notarized by Apple, so Gatekeeper will refuse it the first time. Open it
once from the right-click menu and macOS remembers the decision:

1. **Right-click** MusterDeck in Applications, choose **Open**
2. Click **Open** again in the dialog

Double-clicking normally works from then on. If you prefer the terminal:

```bash
xattr -dr com.apple.quarantine /Applications/MusterDeck.app
```

(`/install-musterdeck` does this for you.)

### Windows: the first launch

The installer is not signed either, so SmartScreen may warn about an unrecognised
publisher. Choose **More info**, then **Run anyway**.

## What it is

MusterDeck is a desktop app for running many Claude Code sessions at once: a terminal
multiplexer with an orchestration layer. Every session is a real shell process with its
own working directory, transcript and status, and the app watches all of them.

The problem it exists to solve is attention. When twenty agents are working, what you
need to know is not what each one is doing, it is **which ones are waiting on you**.

- **The deck** groups every session by what it is doing, with what costs you most at the
  top: blocked, then waiting on you, then ready for review, then working, then idle. Inside
  each group the longest wait comes first, which is the one question scanning a session
  list cannot answer.
- **Blocked is separated from waiting**, because they are not the same cost. Blocked means
  it cannot continue at all: a permission prompt, an errored turn, a turn cut off
  mid-call, or red CI. Waiting means it stopped at a sensible boundary and asked you
  something.
- **Mark one as read** and it moves to idle until that conversation moves again, so the
  list is something you can actually clear.
- **A count on the dock**, and a dock menu listing what wants you, so you know without the
  app being on screen. Working and idle sessions never count towards it.
- **Notifications you can aim**: per kind, muted per session, and always subject to Do Not
  Disturb.
- **A 3D map** of every repository and session, so a glance tells you where attention is
  needed without reading anything.

## Updates

MusterDeck checks this repository for new releases and can install them for you. The
check is anonymous: no account and no `gh` CLI needed.

## Themes

The map's look is data, not code: one JSON file, re-read without a rebuild. Two themes
ship with the app (a space colony and a samurai village); themes that cannot ship,
because of third-party IP or company branding, live in a separate repository.

## Credits

MusterDeck stands on two MIT-licensed projects, and it would not exist without either.
Both are credited because the ideas were theirs first, and the work done since does not
change that.

- **Claude Command Center**, the multi-session workbench MusterDeck grew out of: the idea
  that the Claude Code session is the thing worth making first-class, and the shape that
  follows from it. A session per tab with its own identity, saved launchers, a status line
  fed by Claude's own hook, per-account isolation, and the transcript index the history
  and cost pages are built on.
- **Bot Crossing** by Jarren Rocks ([botcrossing.com](https://botcrossing.com)), the 3D
  engine behind the map. Its character rig, its instanced crew, its hex plot lattice and
  its recipe-driven buildings are the reason that view exists at all.

Claude Code and Codex are the tools MusterDeck orchestrates. Neither is bundled or
modified, and this project is not affiliated with, endorsed by or sponsored by Anthropic
or OpenAI. Claude and Claude Code are trademarks of Anthropic, PBC; OpenAI and Codex are
trademarks of OpenAI.

## Reporting something

Open an [issue](../../issues). Include the version from the status bar.
