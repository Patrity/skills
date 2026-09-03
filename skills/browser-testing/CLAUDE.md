## Browser testing

- After any UI change (pages, components, layouts, styles, client logic), invoke the `browser-testing` skill and prove it in a real browser with `playwright-cli` before calling the work done. Never the Playwright MCP.
- If `playwright-cli` is not on PATH, install it: `npm install -g @playwright/cli@latest` (browsers are a separate `npx playwright install`).
- Test-account credentials, the dev URL and the routes worth covering belong in a project-local skill (`.claude/skills/<project>-browser-testing/SKILL.md`), never in the shared bundle and never against production.
