---
name: browser-testing
description: Use when validating UI or end-to-end behaviour in a real browser with playwright-cli — after any change to pages, components, styles or client logic, and before claiming UI work is done. Installs @playwright/cli via npm if it is missing.
allowed-tools: Bash, Read
---

# Browser testing with playwright-cli

`playwright-cli` drives a real browser from the terminal, one command per step, with a page
snapshot after each one. Use it — never the Playwright MCP — to **prove** a UI change works.

## 1. Install if missing

Never assume it is installed because a shell alias or an old note says so. Check, then install:

```bash
command -v playwright-cli >/dev/null || npm install -g @playwright/cli@latest
```

If a project-local copy exists, prefer it (`npx --no-install playwright-cli --version`) and prefix
every command below with `npx`.

First-run check — this also downloads nothing, so it fails fast if the browsers are missing:

```bash
playwright-cli open about:blank && playwright-cli close
```

Playwright browsers are a **separate** download from the CLI. When they are absent the run dies
with `Executable doesn't exist at …` inside a box that reads:

```
Looks like Playwright was just installed or updated.
Please run the following command to download new browsers:

    npx playwright install
```

Run the command it prints, verbatim — the tool substitutes your package manager
(`npx playwright install`, `pnpm exec playwright install`, `yarn playwright install`), so a
hard-coded guess can be wrong. `npx playwright install chromium` is enough if you only need one
engine.

## 2. The command reference ships with the package

Do not memorise the surface, read it. The installed package carries its own full reference:

```bash
playwright-cli --help                 # its header carries an "Agent skill: <path>" line
```

Read whatever path `--help` prints — that is the file the installed binary actually ships, and it
is the only path guaranteed to be right for this machine. It lives inside the package's bundled
`playwright-core` (`.../@playwright/cli/node_modules/playwright-core/lib/tools/cli-client/skill/SKILL.md`),
which is why it is not worth reconstructing by hand.

It documents every command — `open`, `goto`, `snapshot`, `click`, `fill`, `select`, `check`,
`press`, `eval`, `screenshot`, `pdf`, `resize`, `console`, `requests`, `route`,
`state-save`/`state-load`, tab and session management, `--raw`/`--json` output. Read it when you
need a command; **this** skill is the workflow, not the manual.

(Do not derive the path from `$(npm root -g)`: that reports npm's *configured* prefix, which is
often not where the binary on your PATH actually lives. Trust `--help`.)

## 3. Get the dev server up first

```bash
<dev command> > /tmp/dev.log 2>&1 &          # background, output to a log you can read
until curl -sf http://localhost:<port> >/dev/null; do sleep 1; done
```

- Poll for readiness. Never `sleep 10` and hope.
- If the default port is taken, pick another, pass it explicitly, and use that same port in every
  URL for the rest of the session.
- Read the log when a page 500s — the server-side stack trace is there, not in the browser.
- **Kill what you started** before you report (see §8).

## 4. Core loop: snapshot → ref → act → assert

```bash
playwright-cli open http://localhost:<port>/some/page
playwright-cli snapshot                       # YAML accessibility tree with [ref=eNN] ids
playwright-cli click e31
playwright-cli fill e20 "search term"
```

- **Refs are per-snapshot.** `e12` is meaningless after a navigation or a re-render — re-snapshot
  before every act on a changed page.
- **Assert with `eval`,** returning JSON so the result is unambiguous:

  ```bash
  playwright-cli eval "() => ({ path: location.pathname, h1: document.querySelector('h1')?.textContent })"
  playwright-cli eval "() => !!document.querySelector('.some-mounted-widget')"
  playwright-cli eval "() => document.querySelector('main').clientWidth"
  ```

- **Judge layout from pixels, not from the DOM.** `playwright-cli screenshot --filename=/tmp/x.png`,
  then actually **read** the PNG. Check for unstyled flashes, clipped text, overflow.
- **Mobile pass:** `playwright-cli resize 390 844`, re-snapshot, re-screenshot. Responsive bugs
  (collapsed nav, overflowing breadcrumbs, off-screen buttons) only show here.
- **Network:** `playwright-cli requests` lists what the page fired — use it to confirm an API call
  or an analytics beacon actually went out, and to spot 4xx/5xx.

## 5. Headless-UI components need a real click

Radix / reka-ui / Headless UI primitives — menus, tabs, selects, trees, switches, dialogs,
collapsibles — listen for full pointer event sequences. `playwright-cli click <ref>` sends those.
`el.click()` inside an `eval` does not, and the component will silently not open. Same for
`select`, `check` and `hover`: use the CLI verb.

## 6. Auth-gated apps: the test-account convention

- Register a dedicated test account **in the dev/staging environment only**. Never in production,
  never a real user's credentials.
- Store its email, password, login steps and dev URL in a **project-local** skill —
  `.claude/skills/<project>-browser-testing/SKILL.md` — beside the routes worth covering. They are
  project facts; they do not belong in this shared bundle.
- Log in once per session, then reuse the session:

  ```bash
  playwright-cli state-save /tmp/auth.json     # after logging in
  playwright-cli state-load /tmp/auth.json     # in later runs, before goto
  ```

## 7. Evidence discipline

- **A green typecheck, lint or build is not evidence that the UI works.** They cannot see a
  component that never mounted, a class that resolved to nothing, or a click handler wired to the
  wrong element.
- Record the **exact commands and their outputs** in your report. "I verified it renders" with no
  command is not a verification.
- Check the console every time: `playwright-cli console` (and `playwright-cli console warning`).
  Hydration mismatches and client-side errors show up there and nowhere else.
- Check `playwright-cli requests` for 4xx/5xx before declaring a page healthy.
- If you could not verify something, say so. Do not infer a passing result from a related one.

## 8. Clean up

```bash
playwright-cli close                 # or close-all / kill-all for stray sessions
kill %1                              # the dev server you started
rm -f /tmp/auth.json                 # any storage state holding credentials
```

Leave no browser running, no port held, and no credentials on disk.
