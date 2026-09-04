## Testing
- Prove UI changes in a real browser with `playwright-cli` before saying they are done — never the Playwright MCP; typecheck and unit tests never catch rendering or wiring bugs.
- If `playwright-cli` is missing, install it with `npm install -g @playwright/cli@latest`; the browsers themselves are a separate one-time `npx playwright install`.

## Skills and rules
- Invoke `browser-testing` after any change to pages, components, styles or client logic. The project-local browser-testing skill (if present) holds this app's URL, routes and dev test account.
