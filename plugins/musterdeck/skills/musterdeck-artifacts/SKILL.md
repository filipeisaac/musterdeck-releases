---
name: musterdeck-artifacts
description: Keep, find and revise pages (HTML or Markdown) in MusterDeck's own Artifact Center, through the conductor tools artifact_publish, artifact_list and artifact_read (and artifact_db_read, artifact_db_write, artifact_watch, artifact_comment), so the user sees them in MusterDeck (Artifacts, on the rail), on their phone, and from every session on any account, Claude or Codex. Use when the user asks for a page, dashboard, report, plan view, chart page, mock-up or any visual write-up and the session runs in MusterDeck; when they say "publish it to MusterDeck", "keep it as an artifact", "put it in my artifacts", "open it on my phone"; or when they ask to find, open, update or build on an artifact made earlier, by any session or account.
---

# MusterDeck's artifacts

MusterDeck keeps the pages sessions make in its own Artifact Center, on the user's computer. A
page kept there belongs to no Claude or Codex account: the user opens it in MusterDeck
(Artifacts on the rail, or a window of its own), on the MusterDeck phone app, and any other session,
on any account or provider, can find it and add a new version. claude.ai artifacts, by contrast,
are private to the Claude account that published them.

## Are the tools here?

The tools come from MusterDeck's built-in tool server, `conductor`:

| Tool | Does |
| --- | --- |
| `mcp__conductor__artifact_publish` | keep a page; with `id`, add a new version of that artifact |
| `mcp__conductor__artifact_list` | find artifacts, by words in the name, description or the page itself |
| `mcp__conductor__artifact_read` | read an artifact's page, the latest version or one given, with its open comments |
| `mcp__conductor__artifact_db_read` | read a page's database: one document, a collection, or everything |
| `mcp__conductor__artifact_db_write` | write to a page's database (`writes`, in order); every open view of the page updates at once |
| `mcp__conductor__artifact_watch` | be told, as a message in this session, of each new version or comment |
| `mcp__conductor__artifact_comment` | comment on an artifact, or answer a comment (`reply_to`) |

They are often listed as deferred tools: load them first, for example with
`ToolSearch` and `select:mcp__conductor__artifact_publish,mcp__conductor__artifact_list,mcp__conductor__artifact_read` (add the others when you need them).

If none of them exists, say why rather than guessing:

- the session was not started by MusterDeck (a plain terminal): MusterDeck's artifacts are not
  reachable from here;
- or Artifacts is switched off: Settings, General, Built-in Tools, Artifacts in MusterDeck turns
  it back on, for sessions started after that.

## Which to use: MusterDeck's artifacts or claude.ai's

When both are available:

- **MusterDeck's** (`artifact_publish`) when the user asked for it, wants the page on their
  phone, in MusterDeck, or reachable from their other accounts and sessions, or did not say
  where. It is the default inside MusterDeck.
- **claude.ai's** (the `Artifact` tool) when the user wants a link to send other people, or a
  page several people use at once (shared rows, presence, roles). MusterDeck copies every
  claude.ai page a session publishes into its own Artifact Center as well, so nothing is lost
  either way, and a copied page that uses the abilities below works here too.

## Publishing a page

1. **Write the page**: a complete HTML page (`<!doctype html>`, a `<title>`), or a Markdown
   document. At most 16 MB. Styles and scripts go inline, or in files beside it (step 3).
2. **It runs cut off from everything** but what MusterDeck answers (next section). Its scripts
   run, but it cannot make any network request (fetch, XHR, WebSocket, a form, a beacon), cannot
   reach the user's computer, and has no storage or cookies. So:
   - put the data in the page itself (a `<script>` with a JSON literal) or in a file beside it
     loaded with `<script src="data.js">`; never `fetch()` it, even its own files;
   - load a library only from `https://cdnjs.cloudflare.com`, `https://cdn.jsdelivr.net`,
     `https://unpkg.com`, `https://cdn.tailwindcss.com` or `https://code.jquery.com`, with an
     exact version (`chart.js@4.4.1`, never `@latest`); fonts from Google Fonts; images as `data:`
     URLs or `https:` addresses;
   - links inside the page do not navigate (on the phone none open at all): put addresses as
     visible text if the user needs them;
   - make it work in a narrow window (the phone) as well as a wide one, in light and dark.
3. **Call `artifact_publish`** with `title` (short), `html` or `markdown` (one of them), and a
   one-sentence `description` (it is searched, and shown under the title). Optional:
   - `files`: images, stylesheets, scripts and data beside the page, each `{ path, text }` or
     `{ path, base64 }` (an image, a font, a PDF), loaded by the relative path the page uses
     (`<img src="img/chart.png">`). Up to 255 files, 15 MB each, 64 MB in all. Prefer inline for
     a small page; files are for images and for data too big to read comfortably in the page;
   - `label`: a short name for this version, such as "Draft to CS";
   - `copy_files`: files from another artifact, `{ from_id, path, version?, as? }`, copied
     without sending their bytes.
4. **Give the user the link it returns**, `musterdeck://artifact/<id>`: clicking it in the
   terminal opens the page in its own window. Say where else it is: Artifacts on
   MusterDeck's rail, and the Artifacts tab on their phone.

## What a page can do

MusterDeck answers claude.ai's own page API, `await claude.use(name)`, which resolves a namespace
or `null` (render without it and light features up when it resolves; never block the first paint
on it). The same page works on claude.ai. Not declared anywhere: just use them.

| Name | Gives the page |
| --- | --- |
| `claude.use("artifact")` | `publish(html)`: the page saves itself as a new version (the whole document, doctype first, its state embedded as data). Every open view, the phone too, reloads to it. Publish after the person acts, never on load |
| `claude.use("db")` | documents beside the page: `doc("tasks/t1").get/set/update/delete/onSnapshot`, `collection("tasks").add/where/orderBy/limit/get/onSnapshot`. Live: a write from the page, the phone or a session (`artifact_db_write`) reaches every open view. Best for a dashboard sessions keep current |
| `claude.use("user")` | the one person here: `id()`, `me()`, `isOwner()` and `canEdit()` true |
| `claude.use("assets")` | `upload(blob)` keeps a file the person adds (images, PDF, fonts, text; 20 MB each), served at `/_blob/<id>`; `list()`, `delete(id)` |
| `claude.use("downloads")` | `save({ filename, data })` offers a file the page made: the save dialog, or the phone's share sheet |
| `claude.use("files")` | `list()` and `read(path)` in the folder the page was made from (asks the person first) |
| `claude.use("sample")` | ask Claude: `await sample(text or [{role, content}], { onText, modelTier })`, `sample.json(...)`; no tools. Runs on the computer's Claude account and uses its usage (asks the person first) |
| `claude.use("mcp")` | `callTool(server, tool, input)` and `watchTool(...)` on the computer's connectors, one tool at a time, each call a short Claude turn (asks the person first, per tool) |
| `claude.use("comments")` | `openComposer({ element })` and `anchorFor(element)`: a comment pinned to part of the page. The person also comments from the page's bar |
| `claude.use("permissions")` | `state()`, `request(names)`, `manage()` |

`room`, `dictation` and `tts` answer `null` here. A page with `<section class="slide">` (or
`[data-slide]`) for each slide gets Present, and a PowerPoint export, in MusterDeck; any HTML page
exports as a PDF.

## Revising one, or building on someone else's

1. **Find it**: `artifact_list` with words from its name or content (`query`), or with no query
   for the most recent. Each row gives the id, the title, the latest version and the session
   that made it.
2. **Read it**: `artifact_read` with the `id` (and a `version` for an older one). It lists the
   files beside the page; read one with `path`. Revise what is there; do not rewrite from memory,
   another session may have changed it since.
3. **Publish the revision with the same `id` and `if_version`** set to the version you read: it
   becomes the next version, and every earlier version is kept. Without `if_version` it is refused.
   If another session published in between, or the person saved from the page, it is refused and
   names the live version: read that one, make your change on it, and publish again with its
   number. Leaving out the `id` makes a separate artifact, which is right only when the user wants
   a new page.
4. **Files carry over**: the new version keeps the last one's files. Give a file again to change
   it, and name one in `remove_files` to leave it out.

An unknown `id` is refused, never quietly made into a new artifact: list again and use the id it
shows.

## Comments and watching

The person comments on a page from MusterDeck or the phone, and can send a comment to a session.
`artifact_read` lists the open comments with their ids. Answer one with `artifact_comment` and
`reply_to`, or revise the page. When the user wants a session to follow a page they edit,
`artifact_watch` makes this session hear of each new version and comment.

## What not to do

- Do not delete artifacts: there is no tool for it, on purpose. The user deletes in MusterDeck.
- Do not put secrets, tokens or personal data the user did not ask for into a page: anyone at the
  user's computers, and their phone, can open it.
- Do not paste the whole page back into the chat after publishing it: give the link and a line
  on what is in it.
