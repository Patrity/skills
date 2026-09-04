---
paths:
  - "docs/**"
---

# Three tiers, each with one job

Do not add a fourth. When a document does not fit one of these, it belongs in a rule, a skill, or
the code.

| Tier | Path | Answers | Lifetime |
| --- | --- | --- | --- |
| Handover | `docs/handovers/` | What shipped, what was deferred, where the next seam is | Written before hand-off, updated through acceptance, then frozen |
| Wiki | `docs/wiki/` | How this system works **today** — one page per system | Living: updated in the same change that ships the behaviour |
| Spec / plan | `docs/superpowers/{specs,plans}/` | What we intended, and in what order | Frozen at brainstorm/planning time |

**Code plus the newest handover are truth.** The spec holds intent, which may have been overtaken;
the wiki holds current behaviour. Never resolve a disagreement by editing the spec to match the
code — the divergence is the interesting part, and it belongs in the handover.

## The parity rule

A wiki page that describes shipped work as unbuilt has misled past sessions, and prose reminders
did not hold. So parity is mechanical:

- `docs/wiki/_systems.json` lists every system with its `page` and its `status`
  (`planned` → `building` → `shipped`).
- A test asserts every registered page exists and every page under `docs/wiki/` is registered.
- **When you ship or change a system, update its page and its registry entry in the same change.**
  A separate "docs pass" later is the failure mode this replaces.

Run the `wiki-parity` skill to install or fix that test.

## Handovers

Write one **before** handing back to the user, not after — the deferred list and the next seam are
the parts that are impossible to reconstruct a week later. Frontmatter is always accurate
(`title`, `date`, `status`, `cycle`, `summary`); `status` moves `draft` → `accepted` only once the
user has accepted the work. Run the `handover` skill for the template and the section list.
