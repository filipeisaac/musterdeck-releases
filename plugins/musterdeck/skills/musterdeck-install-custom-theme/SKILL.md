---
name: musterdeck-install-custom-theme
description: List and install MusterDeck Crew themes that do not ship with the app (the Jedi Enclave, the Galley Kitchen, and whatever else is published) from the musterdeck-themes repository. Use when asked to install, update, list or check a custom or extra Crew theme for MusterDeck, or when someone asks which themes they can add.
---

# Installing a custom Crew theme

MusterDeck ships with two Crew themes (Harbour and the Samurai Village). Others are
distributed separately, from **`filipeisaac/musterdeck-themes`**,
because they carry someone else's IP or branding. A theme is one JSON file; installing it
means putting it at `<data dir>/themes/<id>/theme.json` and reloading themes in the Crew.
No rebuild, no restart.

This skill checks that repository, shows what is there against what this machine already
has, installs what the user picks, and says how to switch to it. Do the steps in order and
do not skip the checks: a theme the app cannot validate is refused WHOLE, silently, and
simply never appears, which is the most confusing way for this to go wrong.

## 1. Where this machine keeps its themes

The data directory keeps the app's old name on purpose (moving it would orphan data):

| OS | Data directory |
| --- | --- |
| macOS | `~/Library/Application Support/Claude Conductor` |
| Windows | `%LOCALAPPDATA%\Claude Command Center` |
| Linux | `~/.claude-conductor/data` |

It can be moved by a `DataDirectory` override (the Windows registry, or the app's setup);
if the folder above does not exist, ask the user where MusterDeck keeps its data rather
than creating it. A DEVELOPMENT build (`npm run dev`) uses `<data dir>/dev/` instead, so
install into `dev/themes/` only if the user says they are testing a dev build.

List what is installed: every `themes/<id>/theme.json` under it, with the SHA-256 of each.

## 2. Which app this is

A theme records the oldest app that can load it (`minApp`). Find the installed version:

- macOS: `defaults read /Applications/MusterDeck.app/Contents/Info.plist CFBundleShortVersionString`
- Windows: the version in the installed `MusterDeck.exe`'s properties, or ask
- Anywhere: the status bar shows `CLI vX.Y.Z` at the bottom of the app; ask the user to read it

If you cannot find it, say so and carry on; you will warn instead of blocking in step 4.

## 3. What the repository offers

The repository is public, so read the index over plain HTTP. **Do not require the GitHub
CLI here** -- no sign-in is needed, and asking for one turns a working machine away:

```bash
curl -fsSL https://raw.githubusercontent.com/filipeisaac/musterdeck-themes/main/themes/index.json
```

Each row is `{ id, name, blurb, file, sha256, minApp, crew, why }`.

If this fails, say which it is and stop: no network, or the URL 404s because the
repository or its default branch moved. Neither is something to work around by guessing at
a theme file directly -- the index is what carries the checksum you are about to verify
against, so without it there is nothing to trust a download by.

## 4. Show the options

One short table, a row per theme in the index:

| Theme | Crew | Needs | On this machine |
| --- | --- | --- | --- |

"On this machine" is one of:

- **not installed**
- **installed, current**: the installed file's SHA-256 equals the index's
- **installed, differs**: an update is available, OR the user edited their copy. You cannot
  tell which from a hash, so say both, and never overwrite it without asking.
- **app too old**: `minApp` is newer than the installed app. Name both versions.

Then ask which to install with `AskUserQuestion` (multi-select; one option per theme that
is not already current, with the blurb as its description). If everything is current,
say so and stop.

## 5. Install what was picked

For each theme picked:

1. **Too old an app:** do not install unless the user confirms after being told the theme
   will not appear until MusterDeck is updated.
2. Download it:
   ```bash
   curl -fsSL "https://raw.githubusercontent.com/filipeisaac/musterdeck-themes/main/<file>" \
     -o "<scratch>/<id>.theme.json"
   ```
3. Check it before it goes anywhere: its SHA-256 equals the index's `sha256`, it parses as
   JSON, and its `"id"` equals the index's `id`. If any check fails, install nothing for
   that theme and report which check failed.
4. If `<data dir>/themes/<id>/theme.json` exists, copy it to `theme.json.bak-<YYYYMMDD>`
   in the same folder first.
5. Write the new file to `<data dir>/themes/<id>/theme.json`, creating the folder.

**The folder name must be the theme's `id`.** MusterDeck remembers the chosen theme by id;
a folder under any other name loads once and falls back to the default on the next launch.
Write nothing outside `<data dir>/themes/<id>/`.

## 6. Tell them how to switch

> Open the **Crew** view, open its view menu, choose **Reload themes**, then pick the theme
> under **Themes**.

If it does not appear after reloading, the app refused it: the usual cause is an app older
than the theme's `minApp`, so update MusterDeck. Say which themes were installed, which
were updated (and where the backup is), and which were skipped and why.
