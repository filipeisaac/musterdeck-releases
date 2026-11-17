---
name: musterdeck-artifacts
description: Keep, find and revise pages (HTML or Markdown) in MusterDeck's own Artifact Center, through the conductor tools artifact_publish, artifact_list and artifact_read, so the user sees them in MusterDeck (Tools, Artifacts), on their phone, and from every session on any account, Claude or Codex. Use when the user asks for a page, dashboard, report, plan view, chart page, mock-up or any visual write-up and the session runs in MusterDeck; when they say "publish it to MusterDeck", "keep it as an artifact", "put it in my artifacts", "open it on my phone"; or when they ask to find, open, update or build on an artifact made earlier, by any session or account.
---

# MusterDeck's artifacts

MusterDeck keeps the pages sessions make in its own Artifact Center, on the user's computer. A
page kept there belongs to no Claude or Codex account: the user opens it in MusterDeck
(Tools, Artifacts, or a window of its own), on the MusterDeck phone app, and any other session,
on any account or provider, can find it and add a new version. claude.ai artifacts, by contrast,
are private to the Claude account that published them.

## Are the tools here?

The tools come from MusterDeck's built-in tool server, `conductor`:

| Tool | Does |
| --- | --- |
| `mcp__conductor__artifact_publish` | keep a page; with `id`, add a new version of that artifact |
| `mcp__conductor__artifact_list` | find artifacts, by words in the name, description or the page itself |
| `mcp__conductor__artifact_read` | read an artifact's page, the latest version or one given |

They are often listed as deferred tools: load them first, for example with
`ToolSearch` and `select:mcp__conductor__artifact_publish,mcp__conductor__artifact_list,mcp__conductor__artifact_read`.

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
  page that needs claude.ai's runtime (a shared database, comments, sign-in, Claude calls from
  the page). MusterDeck copies every claude.ai page a session publishes into its own Artifact
  Center as well, so nothing is lost either way.

## Publishing a page

1. **Write one self-contained file**: a complete HTML page (`<!doctype html>`, a `<title>`, the
   styles and scripts inline), or a Markdown document. At most 10 MB.
2. **It runs cut off from everything.** Its scripts run, but it cannot make any network request
   (fetch, XHR, WebSocket, a form, a beacon), cannot reach the user's computer, and has no storage
   or cookies. So:
   - put the data in the page itself (a `<script>` with a JSON literal), never fetch it;
   - load a library only from `https://cdnjs.cloudflare.com`, `https://cdn.jsdelivr.net` or
     `https://unpkg.com`, with an exact version (`chart.js@4.4.1`, never `@latest`); fonts from
     Google Fonts; images as `data:` URLs or `https:` addresses;
   - links inside the page do not navigate (on the phone none open at all): put addresses as
     visible text if the user needs them;
   - make it work in a narrow window (the phone) as well as a wide one, in light and dark.
3. **Call `artifact_publish`** with `title` (short), `html` or `markdown` (one of them), and a
   one-sentence `description` (it is searched, and shown under the title).
4. **Give the user the link it returns**, `musterdeck://artifact/<id>`: clicking it in the
   terminal opens the page in its own window. Say where else it is: Tools, Artifacts in
   MusterDeck, and the Artifacts tab on their phone.

## Revising one, or building on someone else's

1. **Find it**: `artifact_list` with words from its name or content (`query`), or with no query
   for the most recent. Each row gives the id, the title, the latest version and the session
   that made it.
2. **Read it**: `artifact_read` with the `id` (and a `version` for an older one). Revise what is
   there; do not rewrite from memory, another session may have changed it since.
3. **Publish the revision with the same `id`**: it becomes the next version, and every earlier
   version is kept. Leaving out the `id` makes a separate artifact, which is right only when the
   user wants a new page.

An unknown `id` is refused, never quietly made into a new artifact: list again and use the id it
shows.

## What not to do

- Do not delete artifacts: there is no tool for it, on purpose. The user deletes in MusterDeck.
- Do not put secrets, tokens or personal data the user did not ask for into a page: anyone at the
  user's computers, and their phone, can open it.
- Do not paste the whole page back into the chat after publishing it: give the link and a line
  on what is in it.
