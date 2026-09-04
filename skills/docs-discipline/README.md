---
name: Docs Discipline
description: The three-tier docs model (handovers, living wiki, frozen specs) with a handover skill and a mechanical wiki-parity test.
tags: [docs, handovers, wiki, process]
author: Patrity
authorUrl: https://github.com/Patrity
---

# Docs Discipline

Three tiers, one job each, and a test that stops the living tier from rotting.

| Tier | Path | Answers | Lifetime |
| --- | --- | --- | --- |
| Handover | `docs/handovers/` | What shipped, what was deferred, the next seam | Written before hand-off, updated through acceptance |
| Wiki | `docs/wiki/` | How each system works **today** | Living — updated in the change that ships the behaviour |
| Spec / plan | `docs/superpowers/{specs,plans}/` | What we intended, in what order | Frozen at brainstorm time |

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/handover/` | When to write a handover, the frontmatter, the four sections, and updating it through acceptance. |
| `skills/wiki-parity/` | The `_systems.json` registry, the status ladder, and a vitest that fails when the wiki and the directory disagree. |
| `skills/wiki-parity/wiki-parity.test.ts` | The test itself — copy it into your project's test directory. |
| `skills/wiki-parity/_systems.example.json` | A starting registry to copy to `docs/wiki/_systems.json`. |
| `rules/docs.md` | Fires on anything under `docs/` — the tier model and the parity rule, pointing at both skills. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Why a test and not a reminder

The recurring failure is not that people dislike docs — it is that no single code change obviously
"belongs" to the page that describes it. So the page keeps saying a deployed system is unbuilt, and
a later session reads it and plans work that already exists. `docs/wiki/_systems.json` names every
system and its page; the test asserts every registered page exists and every page is registered.
Adding a page without registering it fails the suite, which puts the decision in the commit that
created the drift rather than in a docs pass that never happens.

The test does not try to infer whether a system is "really" shipped — that would be a test nobody
trusts. It enforces the mechanical half and leaves the status to the change that ships the system.

## Install

```bash
unzip docs-discipline.zip
mkdir -p .claude/skills .claude/rules docs/wiki test/docs
cp -R docs-discipline/skills/. .claude/skills/
cp -R docs-discipline/rules/. .claude/rules/
cat docs-discipline/CLAUDE.md >> CLAUDE.md

# wire the parity test into your own suite
cp .claude/skills/wiki-parity/_systems.example.json docs/wiki/_systems.json
cp .claude/skills/wiki-parity/wiki-parity.test.ts test/docs/wiki-parity.test.ts
```

Then edit `docs/wiki/_systems.json` so it lists your systems, and check the test's location
matches your runner's `include` glob. The first run usually fails with a list of unregistered
pages — that list is the backlog.

## Requirements

- A vitest-compatible runner for `wiki-parity.test.ts` (the file imports `vitest`, `node:fs` and
  `node:path` only; port its five assertions to any other runner in a few minutes).
- Nothing at all for the handover skill.

## Companion bundles

- **[`iterative-spec-design`](/skill/iterative-spec-design)** — how the frozen tier gets written in
  the first place, section by section.
- **[`quality-hooks`](/skill/quality-hooks)** — the `PreCompact` hook that asks whether the session
  learned something worth writing down, while the context that learned it still exists.
