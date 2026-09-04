## Docs
- Three tiers, each with one job: `docs/handovers/` (what shipped, what was deferred, the next seam — written before hand-off, updated through acceptance), `docs/wiki/` (how each system works **today**, one page per system with a status ladder), `docs/superpowers/{specs,plans}/` (intent, frozen at brainstorm time).
- Code plus the newest handover are truth; the spec holds intent, the wiki holds current behaviour. Update the wiki page and its `docs/wiki/_systems.json` entry in the same change that ships the system — the parity test fails on a missing or unregistered page.

## Skills and rules
- Invoke `handover` before handing work back to the user, and again when the user accepts it.
- Invoke `wiki-parity` to install or fix the registry test; keep it running in CI, not just locally.
- `.claude/rules/docs.md` loads on anything under `docs/` and carries the tier model.
