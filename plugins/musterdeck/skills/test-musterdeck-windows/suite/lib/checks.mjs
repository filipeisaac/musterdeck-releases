/**
 * checks.mjs -- the read-only checks `run-suite.mjs` runs, in order. ONE list, which
 * `tests/unit/wsl-suite.test.ts` holds against the folder: a new check script that is not
 * listed here fails the unit suite, so it cannot be left out of the tester's run.
 *
 * Each entry: `script`, an `id` (unique), the `phase` from the plan that added it, and:
 *   wsl        pass `--require-wsl` in a WSL run
 *   extra      more arguments; `{project}` and `{environment}` are filled from run-suite's own
 *   when       only with that run-suite option: 'project', 'codexRun', 'insightsRun'
 *   timeoutMs  how long it may take (default 3 minutes)
 */
export const CHECKS = [
  { id: 'list-sessions', script: 'list-sessions.mjs', phase: 'P1', wsl: false },
  { id: 'distro-home', script: 'distro-home.mjs', phase: 'P2', wsl: true },
  { id: 'versions', script: 'versions.mjs', phase: 'P7', wsl: true },
  { id: 'logs', script: 'logs.mjs', phase: 'P3', wsl: true },
  { id: 'crew-card', script: 'crew-card.mjs', phase: 'P3', wsl: true },
  { id: 'resume-picker', script: 'resume-picker.mjs', phase: 'P3', wsl: true },
  { id: 'tokenomics', script: 'tokenomics.mjs', phase: 'P4', wsl: true },
  { id: 'memory', script: 'memory.mjs', phase: 'P4', wsl: true },
  { id: 'projects', script: 'projects.mjs', phase: 'P4', wsl: true },
  { id: 'insights', script: 'insights.mjs', phase: 'P4', wsl: false },
  { id: 'skills', script: 'skills.mjs', phase: 'P5', wsl: true },
  { id: 'git', script: 'git.mjs', phase: 'P6', wsl: true },
  { id: 'ctrl-click', script: 'ctrl-click.mjs', phase: 'P6', wsl: true },
  { id: 'codex', script: 'codex.mjs', phase: 'P7', wsl: true },
  { id: 'ram', script: 'ram.mjs', phase: 'P8', wsl: true },
  { id: 'primary', script: 'primary.mjs', phase: 'P8', wsl: true },
  { id: 'primary-project', script: 'primary.mjs', phase: 'P8', wsl: true, extra: ['--project', '{project}'], when: 'project' },
  { id: 'accounts', script: 'accounts.mjs', phase: 'P8', wsl: true },
  // After the read-only checks: it clicks through the pages (and back to Chat), so the
  // ones above see the window as the drivers left it.
  { id: 'pages', script: 'pages.mjs', phase: 'P9', wsl: false },
  { id: 'codex-run', script: 'codex.mjs', phase: 'P7', wsl: true, extra: ['--run'], when: 'codexRun', timeoutMs: 240_000 },
  { id: 'insights-run', script: 'insights.mjs', phase: 'P4', wsl: false, extra: ['--run', '--environment', '{environment}'], when: 'insightsRun', timeoutMs: 20 * 60_000 },
]

/**
 * The suite's other scripts: drivers that DO things (set up, create, quit) or report, and are
 * run by the skill directly rather than by run-suite. Listed so the unit test can tell an
 * unlisted check from a driver.
 */
export const DRIVERS = ['preflight.mjs', 'onboarding.mjs', 'setup-environment.mjs', 'fixtures.mjs', 'lifecycle.mjs', 'run-suite.mjs', 'quit-app.mjs', 'update-gate.mjs', 'report.mjs', 'screenshot.mjs', 'type.mjs']
