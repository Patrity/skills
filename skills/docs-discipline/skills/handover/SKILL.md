---
name: handover
description: Use when finishing a piece of work and handing back to the user — writes docs/handovers/<date>-<slug>.md with accurate frontmatter, what shipped, what was deferred, the next seam and how to verify. Also use when updating an existing handover through user acceptance.
allowed-tools: Read, Write, Edit, Bash
---

# Writing a handover

A handover is the one document the next session reads first. It is written **before** the user is
handed the work back — not afterwards, when the deferred list has already evaporated.

## When to write one

- Implementation is complete and you are about to say "this is done".
- A cycle, milestone or branch ends, even unfinished — an abandoned thread with a written seam is
  recoverable; one without is not.
- **Not** for every commit. One handover per unit of work the user will accept or reject.

## Where and what to name it

```
docs/handovers/YYYY-MM-DD-<short-slug>.md
```

One file per unit of work. Never overwrite yesterday's.

## Frontmatter — always accurate

```yaml
---
title: Skill registry — download and zip pipeline
date: 2026-09-03
status: draft        # draft | accepted
cycle: registry-mvp  # the spec/plan this belongs to, or the milestone name
summary: Bundles download as zips built in-memory; the GitHub source is cached per bundle.
---
```

`summary` is one sentence, read on its own in a directory listing — write it so it survives that.
`status: draft` while the work is in review; flip it to `accepted` when the user accepts, in the
same edit as any correction they asked for. A stale `draft` at the top of the newest handover
tells the next session the work was never accepted, which is a lie that costs an hour.

## Sections

### Shipped

What now exists and works, in the reader's terms — behaviour, not a commit list. Name the files
that carry it so the next session can jump straight in. If a decision changed during the build,
say what it was and why, because the spec still shows the old one.

### Deferred

What was consciously left out, and *why it was safe to leave out*. Distinguish "not needed" from
"needed, not done" — the second is a debt and must say what happens if it stays undone. Anything
tracked elsewhere (an issue, a task) gets its identifier here.

### Next seam

Where the next session should cut. One or two concrete entry points: the file, the function, the
question that is now answerable. Not a wish list — the *single* most load-bearing next move,
described precisely enough to start without re-deriving the design.

### How to verify

The exact commands, in order, with what a passing run looks like. Someone who was not here must be
able to reproduce your confidence. "Tests pass" is not verification; `pnpm test:unit` with the
count is.

## Update it through acceptance

The handover stays live until the user accepts. When they come back with a correction, fix the
work, then fix the handover in the same change — the Shipped and Deferred lists move, and `status`
becomes `accepted`. A handover that describes the version the user rejected is worse than none.

## Before you call it written

- [ ] Frontmatter complete, `date` today, `summary` one sentence.
- [ ] Every claim in Shipped is something you actually ran or read, not something you expect.
- [ ] Deferred says why each omission is safe.
- [ ] Next seam names a file or a function.
- [ ] How to verify was copy-pasted from a terminal, not from memory.
