/**
 * human.mjs -- what the parity run cannot judge by itself: it needs eyes, a sign-in in a
 * browser, another device, or it would disrupt the machine. Each item says exactly what to do
 * and what to look for. The skill walks the tester through them at the END of the run, and
 * `report.mjs --set human.<id>` records each answer.
 *
 * `when`: 'always', 'codex' (Codex is installed in the distro), 'vscode' (VS Code is
 * installed), 'consent' (disruptive: only after an explicit yes, and never while Claude runs
 * inside WSL itself).
 */
export const HUMAN = [
  {
    id: 'toast', when: 'always', title: 'A Windows notification from an Ubuntu session',
    do: 'Put MusterDeck behind another window. Claude types into the Ubuntu Claude session: "create a file named md-suite-toast.txt" (it asks permission).',
    look: 'A Windows notification appears; clicking it brings MusterDeck forward on that session. Then answer the permission with No.',
  },
  {
    id: 'cloud-title', when: 'always', title: 'The renamed session on claude.ai or the phone',
    do: 'Open claude.ai/code in a browser (or the Claude app on the phone) and find the recent sessions list.',
    look: 'The Ubuntu Claude session is listed by its new name, "md-suite ubuntu claude renamed <stamp>", not by a hostname like ip-192-168-...',
  },
  {
    id: 'explorer-drag', when: 'always', title: 'A real drag from Explorer',
    do: 'Claude opens the fixture folder in Explorer. Drag "drop me.txt" onto the Ubuntu shell session\'s terminal. Do not press Enter.',
    look: "The terminal shows a quoted Linux path ending in drop me.txt, starting '/mnt/c/. Claude reads the terminal and compares it with the dry run.",
  },
  {
    id: 'vscode', when: 'vscode', title: 'Ctrl+click opens VS Code in WSL',
    do: 'In the Ubuntu Claude session\'s Partner Terminal, Claude types ls. Ctrl+click notes.md.',
    look: 'VS Code opens notes.md with "WSL: Ubuntu" in its bottom left corner. Close VS Code afterwards. Only when Windows opens .md files with VS Code: with no app for .md, Windows shows its own picker instead (close it, choose nothing).',
  },
  {
    id: 'crew', when: 'always', title: 'The Crew shows the Ubuntu sessions',
    do: 'Claude opens the Crew and takes a screenshot. Look at the map.',
    look: 'Each open md-suite session has an agent; clicking the Ubuntu Claude one shows its conversation (the marker word) on the card. Nothing is blank or black.',
  },
  {
    id: 'crew-roam', when: 'always', title: 'An idle bot dragged to another zone stays there',
    do: 'On the Crew, drag an idle md-suite figure (no badge over its head) onto a different zone, wait 30 seconds; then drag one onto bare ground outside every zone and wait 15 seconds.',
    look: 'The first stays and potters on the zone you dropped it on (it used to run home after 5 s). The second walks back onto the nearest zone by itself.',
  },
  {
    id: 'drawer', when: 'always', title: 'The Terminal button rolls a terminal up under Claude',
    do: 'On the Ubuntu Claude session, click Terminal on the bar under it; drag the drawer\'s top edge up and down; press Esc; click Terminal again.',
    look: 'A terminal in the session\'s Ubuntu folder slides up over the bottom third, Claude stays visible above it, the edge resizes it, Esc puts the cursor back in Claude, and reopening shows the same terminal with its earlier output.',
  },
  {
    id: 'play-error', when: 'always', title: 'Play on a command that fails, then "I get an error" (1.0.136)',
    do: 'On the Ubuntu Claude session, ask Claude: "Give me a bash command that lists a folder called nothing-here". Beside its command, click Copy and paste it into Notepad; then click Play. Go back to Claude and write only: I get an error',
    look: 'A small Play and Copy pill sits just after the command. Copy put the command in Notepad. Play rolled the Terminal up and ran it there. After "I get an error", Claude names the error the Terminal printed (No such file or directory) without you pasting anything.',
  },
  {
    id: 'account-add', when: 'always', title: 'Add a second account in Ubuntu (sign-in in the browser)',
    do: 'Settings > Accounts > "Add an account in Ubuntu". In the Ubuntu tab that opens, sign in with a DIFFERENT account than Ubuntu already uses (or the same email in another organisation). Skip this and the account items below if there is no second account.',
    look: 'The account appears in the Ubuntu section and the tab is labelled with its email. Claude then checks its folder with accounts.mjs.',
  },
  {
    id: 'account-same', when: 'always', title: 'The same account twice is refused',
    do: 'Add an account in Ubuntu again, and sign in with the account Ubuntu already uses.',
    look: '"You are already signed in as ... here", and the half-made account disappears from the list.',
  },
  {
    id: 'account-abandon', when: 'always', title: 'Closing a sign-in tab early leaves nothing behind',
    do: 'Add an account in Ubuntu once more, and close the sign-in tab before signing in.',
    look: 'Nothing new is left in the list. Claude checks that no new folder is left under ~/.musterdeck/profiles in Ubuntu, that no Claude is still running there with that profile (pgrep -af claude), and app.log says "stopped N terminal(s) under <id>" (1.0.156: a sign-in given up on used to leave its Claude at the login prompt).',
  },
  {
    id: 'account-session', when: 'always', title: 'A session on the added account, and Switch',
    do: 'New Session, place Ubuntu: the account picker lists only Ubuntu accounts; pick the added one and Create. Then, on the status line account menu, Switch to the other Ubuntu account, and back.',
    look: 'The picker and the menu list only Ubuntu accounts, each with its organisation. The chip and `claude /status` agree on the account; after each Switch the SAME conversation continues, and a question typed right after the Switch is SENT by Enter (it once stayed in the input as new lines, 2026-10-07). Claude then re-runs logs, tokenomics, skills and accounts for this session.',
  },
  {
    id: 'account-usage', when: 'always', title: 'Account usage and the Limits card',
    do: 'Open Account usage (sidebar Tools) and Tokenomics. On the added Ubuntu account in the usage overview, click Sign in (re-auth) and finish it, if it offers one (only an expired sign-in does).',
    look: 'Ubuntu accounts carry an UBUNTU tag with real percentages, and each row names its organisation (two plans on one email are told apart, with different dots), in the Limits card too. The Windows row says Updated, not "couldn\'t refresh" (if it does, copy the [account-usage] ... usage not refreshed line from app.log). The row refreshes after a re-auth.',
  },
  {
    id: 'account-default', when: 'always', title: 'Default account and Insights per account',
    do: 'Tick "default for new sessions" on the added Ubuntu account, open New Session (Ubuntu, then Windows). Then Insights: choose the added Ubuntu account and run it (Claude says first that it spends tokens).',
    look: 'The default is pre-selected for Ubuntu sessions only. On Insights, choosing Ubuntu shows an account picker listing both Ubuntu accounts by organisation with the default pre-selected; the run says it ran under that account (the catalogue run carries its profileId, and its report comes from ~/.musterdeck/profiles/<id>/.claude/usage-data, not ~/.claude/usage-data).',
  },
  {
    id: 'account-remove', when: 'always', title: 'Remove the added Ubuntu account',
    do: 'Settings > Accounts: Remove the added Ubuntu account while its session is open, then close that session and Remove again.',
    look: 'Refused while the session is open; then it goes. Claude checks ~/.musterdeck/profiles/<id> is gone and ~/.claude is untouched.',
  },
  {
    id: 'codex-human', when: 'codex', title: 'Codex in Ubuntu, by eye',
    do: 'New Session, Ubuntu, provider Codex, in the fixture repo; one short turn. Quit and reopen MusterDeck (Claude does it). Then, in the Ubuntu Claude session, ask for a Codex review of notes.md.',
    look: 'The strip shows context and cost after the turn; after the relaunch the same Codex conversation continues; the review comes back in the Claude session.',
  },
  {
    id: 'wsl-shutdown', when: 'consent', title: 'wsl --shutdown with sessions open (disruptive)',
    do: 'Only with a clear yes: it stops EVERYTHING running in WSL, Docker included. Claude runs wsl --shutdown from PowerShell and watches the Ubuntu Claude tab.',
    look: 'Within seconds the tab ends as a crashed session does: [Process exited with code 1], and Restart on the status line. Restart (with "Starting Ubuntu..." if Ubuntu has stopped by then) brings back the SAME conversation (asked, it answers the marker word). Usage panels show the last figures or "Ubuntu is not running" and do not start Ubuntu.',
  },
]
