---
name: Iterative Spec Design
description: Design a system section by section with an approval checkpoint after each one, so a wrong assumption is caught in section two instead of in the finished spec.
tags: [process, planning, specs]
author: Patrity
authorUrl: https://github.com/Patrity
---

# Iterative Spec Design

One skill, one habit: partition the design into four to six sections, present each with a
recommendation and a rationale, and stop for feedback before moving on.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/iterative-spec-design/` | When to use it, the six-step workflow, checkpoint phrasing, the anti-patterns, and the shape of the spec the sections compile into. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Why

The expensive failure in spec writing is not a bad section — it is a bad *assumption* in an early
section that the next four sections are built on. Writing the whole document first hides that
assumption until the point where correcting it means rewriting everything. Checkpoints surface it
while it is still cheap, and they change the user's job from rubber-stamping a finished artefact to
steering an unfinished one.

The skill is deliberate about the phrasing too: "Make sense? Any changes before I move on?" invites
a correction, where "Approved?" invites a yes.

## Install

```bash
unzip iterative-spec-design.zip
mkdir -p .claude/skills
cp -R iterative-spec-design/skills/. .claude/skills/
cat iterative-spec-design/CLAUDE.md >> CLAUDE.md
```

No dependencies, no configuration — it is a procedure, not a tool.

## Where the output goes

Sections compile into `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md` with a decisions
table and explicit scope boundaries. That path is the frozen tier of the docs model — the spec
records what was intended, and it stays as written even after the code moves on.

## Companion bundles

- **[`docs-discipline`](/skill/docs-discipline)** — where the finished spec lives, and the handover
  that records what actually shipped against it.
