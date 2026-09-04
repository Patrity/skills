## Testing
- Validate every UI change in a real browser with `playwright-cli` (never the Playwright MCP): dev server up → `snapshot` → act on refs → `eval` assertions → read a screenshot. The `browser-testing` skill has the workflow; the project-local `{{projectName}}-browser-testing` skill has this app's URL and routes.
