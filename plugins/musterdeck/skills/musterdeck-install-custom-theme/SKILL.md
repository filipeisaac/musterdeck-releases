---
name: musterdeck-install-custom-theme
description: List and install MusterDeck Crew themes that do not ship with the app (the Jedi Enclave, the Galley Kitchen, and whatever else is published) from the public musterdeck-themes repository, over plain HTTP with no GitHub CLI. A theme is a folder, its theme.json plus any .glb 3D models (kits) it names; every file is downloaded, SHA-256 checked against the index and installed into the data dir's themes/<id>/ folder, backing up what it replaces. Older flat rows (a descriptor only) still install. Use when asked to install, update, list or check a custom or extra Crew theme for MusterDeck, or when someone asks which themes they can add.
---

# Installing a custom Crew theme

MusterDeck ships with two Crew themes (Harbour and the Samurai Village). Others are
distributed separately, from **`filipeisaac/musterdeck-themes`**,
because they carry someone else's IP or branding.

A theme is a folder: a `theme.json` descriptor, plus any `.glb` 3D models (its **kits**)
that the descriptor names. Installing one means putting that folder at
`<data dir>/themes/<id>/` and reloading themes in the Crew. No rebuild, no restart.

This skill checks that repository, shows what is there against what this machine already
has, installs what the user picks, and says how to switch to it. Do the steps in order and
do not skip the checks: a theme the app cannot validate is refused WHOLE, silently, and
simply never appears, and a kit that is missing costs the buildings drawn from it. Those
are the most confusing ways for this to go wrong.

## What the repository holds

It is written by the MusterDeck repo's `tools/crew-sheet/publish-themes.py`:

| Path in the repo | What it is |
| --- | --- |
| `themes/index.json` | a JSON array, one row per theme (below) |
| `themes/<id>/theme.json` | the theme's descriptor |
| `themes/<id>/<kit>.glb` | a 3D model the descriptor's `world.kits` names, at the path it names (it may be in a subfolder, `models/props.glb`) |
| `themes/<id>.json` | an OLD repo's flat descriptor, for a row without `files` |
| `THEME-REFERENCE.md` (repo root) | the descriptor reference, for people; not read here |

A row of the **folder layout** (what the publisher writes now):

```json
{
  "id": "kit-village", "name": "Kit Village", "blurb": "...",
  "layout": "folder", "dir": "themes/kit-village",
  "file": "themes/kit-village/theme.json", "sha256": "<of theme.json>",
  "files": [
    { "path": "theme.json",  "sha256": "...", "size": 2211 },
    { "path": "village.glb", "sha256": "...", "size": 48120 }
  ],
  "size": 50331,
  "minApp": "1.0.11", "crew": "who the figures are", "why": "why it is not in the app"
}
```

`files` lists EVERY file of the theme, each `path` relative to `dir`, with its SHA-256 and
size in bytes; `size` is their total. A row **without `files`** is the old **flat layout**:
`{ id, name, blurb, file, sha256, minApp, crew, why }`, where `file` is `themes/<id>.json`
and `sha256` is that descriptor's hash. Both install into the same folder; only a folder row
can carry kits.

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

List what is installed, with the SHA-256 of every file in every theme folder (descriptors,
kits in any subfolder, and backups, which step 4 ignores). On macOS or Linux:

```sh
DATA="${HOME}/Library/Application Support/Claude Conductor"   # or the Linux path above
[ -d "${DATA}" ] || echo "no data directory at ${DATA}: ask the user where it is"
find "${DATA}/themes" -mindepth 2 -type f -exec shasum -a 256 {} + 2>/dev/null
```

(`sha256sum` where there is no `shasum`; `Get-FileHash -Algorithm SHA256` in PowerShell.)
No output means no themes are installed. A folder is installed theme `<id>` when it holds
`themes/<id>/theme.json`. Do not write a `for f in "${DATA}"/themes/*/theme.json` loop:
under zsh, the default shell on a Mac, a glob that matches nothing aborts the whole command
with `no matches found`.

## 2. Which app this is

A theme records the oldest app that can load it (`minApp`). Find the installed version:

- macOS: `defaults read /Applications/MusterDeck.app/Contents/Info.plist CFBundleShortVersionString`
- Windows: the version in the installed `MusterDeck.exe`'s properties, or ask
- Anywhere: the status bar shows `CLI vX.Y.Z` at the bottom of the app; ask the user to read it

If you cannot find it, say so and carry on; you will warn instead of blocking in step 4.

## 3. What the repository offers

The repository is public, so read it over plain HTTP. **Do not require the GitHub CLI
here**: no sign-in is needed, and asking for one turns a working machine away. Every read
goes through one function, so each path below is a path in the repository and nothing else:

```sh
fetch() { curl -fsSL "https://raw.githubusercontent.com/filipeisaac/musterdeck-themes/main/$1"; }
SCRATCH="$(mktemp -d)"
fetch themes/index.json > "${SCRATCH}/index.json" && python3 -m json.tool "${SCRATCH}/index.json" >/dev/null && echo "index fetched"
```

(On Windows, `Invoke-WebRequest -UseBasicParsing <url> -OutFile <file>` is the same read.)

If this fails, say which it is and stop: no network, the URL 404s because the repository
or its default branch moved, or the index is not valid JSON. None is something to work
around by guessing at a theme file directly: the index is what carries the checksums you
are about to verify against, so without it there is nothing to trust a download by.

Take every path from the row; never compose one from the id. Filters before anything is
shown, each refusing the row and saying which and why:

- **Themes that ship inside the app are never offered**, even if the index lists them:
  `crew` (Harbour) and `samurai-village`.
- **An `id` becomes a folder name, and the app skips any theme folder whose name is not
  lowercase letters, digits and dashes, starting with a letter or digit**
  (`^[a-z0-9][a-z0-9-]*$`). A row whose id breaks that could never load.
- **A folder row** (it has `files`):
  - `dir` must be exactly `themes/<id>`;
  - every `path` must match `^[A-Za-z0-9._/-]+$`, must not start with `/`, must have no
    `..` segment, and must be either `theme.json` or end in `.glb`. That is what the
    publisher writes, and it is what keeps every download inside `themes/<id>/` on both
    ends;
  - `theme.json` must be listed exactly once, no path twice, and every `sha256` must be 64
    hex characters.
- **A flat row** (no `files`): `file` must be a `.json` path directly under `themes/`.

If nothing is left after that, the repository has nothing to offer this machine: say so and
stop.

## 4. Show the options

One short table, a row per theme left:

| Theme | Crew | Size | Needs | On this machine |
| --- | --- | --- | --- | --- |

"Crew" is the row's `crew` line. "Size" is the row's `size` (the download, all files; for a
flat row say "descriptor only"). "Needs" is its `minApp`. "On this machine" is one of:

- **not installed**: there is no `<data dir>/themes/<id>/theme.json`
- **installed, current**: EVERY file the row lists exists at `<data dir>/themes/<id>/<path>`
  with the row's SHA-256 (a flat row: `theme.json` matches the row's `sha256`). Other files
  in that folder, such as backups, do not count.
- **installed, differs**: some listed file is missing or has another hash. An update is
  available, OR the user edited their copy. You cannot tell which from a hash, so say both,
  name the files that differ, and never overwrite them without asking.
- **app too old**: `minApp` is newer than the installed app. Name both versions.

Then ask which to install with `AskUserQuestion` (multi-select; one option per theme that
is not already current, with the blurb as its description). If everything is current,
say so and stop.

## 5. Install what was picked

For each theme picked:

1. **Too old an app:** do not install unless the user confirms after being told the theme
   will not appear until MusterDeck is updated.
2. **Download every file of the theme** into a staging folder in the scratch folder, never
   straight into the data directory, keeping each file's relative path:
   ```sh
   STAGE="${SCRATCH}/stage/<id>"
   # a folder row, once per entry of files:
   mkdir -p "$(dirname "${STAGE}/<path>")"
   fetch "<dir>/<path>" > "${STAGE}/<path>"
   # a flat row, its one file:
   mkdir -p "${STAGE}" && fetch "<file>" > "${STAGE}/theme.json"
   ```
   A failed download is a failed theme: stop on it, do not install the rest of that theme.
3. **Check it before it goes anywhere.** All of these, and if any fails, install NOTHING of
   that theme and report which check failed and on which file:
   - **every file's SHA-256** (`shasum -a 256 "${STAGE}/<path>"`) equals its row entry's
     `sha256` (a flat row: `theme.json` against the row's `sha256`);
   - `theme.json` parses as JSON (`python3 -m json.tool <file> >/dev/null`, or
     `plutil -convert json -o /dev/null <file>` on macOS);
   - its `"id"` equals the row's `id`;
   - **every kit it names is either built in or downloaded.** Read `world.kits` from the
     descriptor (nothing there is fine: the theme then uses the app's own). A value starting
     with `builtin:` is art the app ships. Any other value is a path in the theme folder,
     and it must be one of the row's `files` paths (compare after dropping a leading `./`).
     For a flat row every value must be `builtin:`, because a flat row carries no kit. A kit
     the download does not include means buildings the app would silently leave undrawn:
     report it to whoever published the theme.
4. **Back up what it replaces.** For each downloaded file, if
   `<data dir>/themes/<id>/<path>` exists and its SHA-256 differs from the new one, copy it
   to `<path>.bak-<YYYYMMDD>` beside it first. If that backup name is taken, add
   `-<HHMMSS>`; never overwrite an older backup. The app reads only the files a descriptor
   names, so a backup in the folder is inert. Files already in the folder that the row does
   not list are left alone (they may be the user's own); mention them.
5. **Write** each checked file to `<data dir>/themes/<id>/<path>`, creating folders as
   needed (`mkdir -p`, then `cp`). Write `theme.json` LAST, so a theme that failed half way
   never has a new descriptor pointing at kits that did not arrive.
6. **Confirm it landed**: re-hash every written file against the row, exactly as step 4's
   "installed, current" check does.

**The folder name must be the theme's `id`.** MusterDeck loads a theme under its FOLDER
name, reads its kits relative to that folder (refusing any path that leaves it), and
remembers the chosen theme by that name; a folder under any other name loads once and falls
back to the default on the next launch. Write nothing outside `<data dir>/themes/<id>/`.

Then remove the scratch folder.

## 6. Tell them how to switch

> Open the **Crew** view, open its view menu, choose **Reload themes**, then pick the theme
> under **Themes**.

If it does not appear after reloading, the app refused it: the usual cause is an app older
than the theme's `minApp`, so update MusterDeck. The Crew's toast and the developer console
list the validation errors in full, including a kit it could not read (`kit "base"
(village.glb): ...`), which usually means a file was moved or renamed after installing.

Say which themes were installed, which were updated (and where each backup is), and which
were skipped and why.
