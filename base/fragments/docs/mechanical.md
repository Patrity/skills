## Docs
- Three tiers, each with one job: `docs/handovers/` (what shipped, what was deferred, next seam — written before user hand-off, updated through acceptance, accurate frontmatter always), `docs/wiki/` (how the system works **today**, one page per system with a status ladder), `docs/superpowers/{specs,plans}/` (intent frozen at brainstorm time).
- Code plus the newest handover are truth; the spec holds intent; the wiki holds current behaviour. Never let a wiki page describe shipped work as unbuilt — stale pages have misled past sessions.
- Wiki parity is mechanical: `docs/wiki/_systems.json` lists every system, and the parity test fails when a registered system has no page or a page nobody registered exists. Update the wiki in the same change that ships the system.
