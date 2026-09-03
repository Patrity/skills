---
paths:
  - "**/*.vue"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.svelte"
  - "**/pages/**"
  - "**/components/**"
  - "**/layouts/**"
---

# Browser testing

- **After changing UI, prove it in a real browser before saying it's done.** Invoke the
  `browser-testing` skill and drive the change through `playwright-cli`: snapshot → click → assert
  with `eval`, screenshot and read it. A green typecheck, lint or build never catches a component
  that failed to mount, a class that resolved to nothing, or a handler on the wrong element.
- **`playwright-cli` installs from npm** (`npm install -g @playwright/cli@latest`) if it is not on
  PATH; browsers are a separate download (`npx playwright install`). Missing tooling is not a
  reason to skip verification.
- **Never use the Playwright MCP** when the CLI is available — one browser session, one source of
  truth for refs.
