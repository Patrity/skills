---
name: {{projectName}}-browser-testing
description: Use when validating UI or end-to-end behaviour of {{projectName}} in a real browser with playwright-cli — this app's URLs, routes and flows. Pairs with the generic browser-testing skill for the command workflow.
---

# Browser testing for {{projectName}}

## Dev server
- Start: `{{pm}} dev` — TODO: confirm the URL (default http://localhost:3000; pick another port if 3000 is taken).
- Ready check: `until curl -sf <dev-url> >/dev/null; do sleep 1; done`

## Routes to cover after UI changes
- TODO: list the routes that matter (home, main flows, an error page).

## Workflow
Follow the `browser-testing` skill: `open` → `snapshot` → act on refs → `eval` assertions → screenshot and read it. Headless-UI components need a real `click <ref>`.
