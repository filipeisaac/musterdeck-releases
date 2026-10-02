/**
 * claude-tui.mjs -- reading Claude Code's own screen out of a terminal's text, for the drivers
 * that talk to a Claude session (lifecycle.mjs). Pure functions over the text
 * `__mdTest.readTerminal` answers, so the unit suite can hold them to real screens.
 */

/** Claude's folder trust question, in the wordings seen so far. */
export const TRUST = /Do you trust the files|trust this folder|Yes, proceed|Is this a project you|Quick safety check/i

/** A line of the screen without a box's side bars and the padding around them. */
const unbox = (line) => line.replace(/^[\s│|]*/, '').replace(/[\s│|]*$/, '')
const CURSOR = /^(❯|›|>)\s+(?=\S)/

/**
 * The options of the select prompt at the bottom of the screen, and which one is selected.
 * Answers `{ options: [{ n, text, selected }], selected, yes }` (the option the cursor is on,
 * and the one that starts with "Yes"), or null when no select prompt is on screen. `n` is the
 * option's place in the list, from 1.
 *
 * The options are the run of lines around the cursor line (`❯ No, exit`), up to a blank line
 * either side; a leading "1." is dropped, since some versions number them and some do not.
 * Never assume an order: Claude Code 2.1.287 lists "No, exit" FIRST and selected, unnumbered,
 * so a bare Enter quits Claude instead of trusting the folder.
 */
export function selectPrompt(text, tailLines = 40) {
  const lines = String(text ?? '').split(/\r?\n/).slice(-tailLines).map(unbox)
  let at = -1
  for (let i = lines.length - 1; i >= 0; i--) if (CURSOR.test(lines[i])) { at = i; break }
  if (at < 0) return null
  let from = at, to = at
  while (from > 0 && lines[from - 1].trim()) from--
  while (to < lines.length - 1 && lines[to + 1].trim()) to++
  const options = lines.slice(from, to + 1).map((line, i) => ({
    n: i + 1,
    text: line.replace(CURSOR, '').replace(/^\d+\.\s+/, '').trim(),
    selected: CURSOR.test(line),
  }))
  if (options.length < 2) return null
  return {
    options,
    selected: options.find((o) => o.selected) ?? null,
    yes: options.find((o) => /^Yes\b/i.test(o.text)) ?? null,
  }
}

/** The options as one evidence line: `1. No, exit; > 2. Yes, I trust this folder`. */
export const describeOptions = (sp) => sp.options.map((o) => `${o.selected ? '> ' : ''}${o.n}. ${o.text}`).join('; ')

/** A line that is the marker alone (Claude's reply), possibly behind its bullet. */
const answerRe = (marker) => new RegExp(`^[^A-Za-z0-9]{0,4}${marker}[.!]?\\s*$`, 'gm')

/** How many lines of `text` are the marker alone. */
export const countAnswers = (text, marker) => (String(text ?? '').match(answerRe(marker)) ?? []).length

/**
 * How many replies that are the marker alone come AFTER the last time `prompt` shows on
 * screen. That is the reply to the prompt just typed, and nothing else: a resumed or restored
 * session replays its whole conversation, earlier replies included, so a count taken before
 * typing is satisfied by the replay, and one taken while the replay is still drawing is
 * satisfied by nothing at all. While the prompt is still in the input box (not yet sent),
 * nothing follows it and this is 0.
 */
export function answersAfterPrompt(text, prompt, marker) {
  const t = String(text ?? '')
  const head = String(prompt).replace(/\s+/g, ' ').trim().slice(0, 30)
  const at = t.lastIndexOf(head)
  if (at < 0) return 0
  const after = t.slice(at + head.length)
  // The rest of the prompt's own line (or lines, when it wrapped) is not a reply.
  const nl = after.indexOf('\n')
  return nl < 0 ? 0 : countAnswers(after.slice(nl + 1), marker)
}
