---
name: iterative-spec-design
description: "Guide stakeholders through multi-section design with approval checkpoints, preventing misalignment before full spec writing"
trigger: "When designing a complex system with multiple distinct concern areas, before committing to a full specification"
version: 1
created_by_agent: claude_code
created_at: 2026-05-18T14:20:35.645Z
updated_at: 2026-05-18T14:20:35.645Z
---

# Iterative Spec Design

Guide stakeholders through complex system designs section-by-section, with approval checkpoints between sections. Prevents misalignment and rework before full spec writing.

## When to Use

- Designing a complex system with 4+ distinct concern areas (auth, data model, API, UI, deployment, etc.)
- Early in a feature, before committing to a detailed spec
- When user assumptions, requirements, or preferences are uncertain or evolving
- After initial brainstorming to validate design directions before formalization

## Workflow

1. **Brainstorm & clarify intent** — understand user's goals, constraints, unknowns, and non-negotiables
2. **Outline the sections** — identify 4–6 logical areas that partition the design space cleanly
3. **Present section-by-section:**
   - State the design clearly (recommendation + rationale, not just options)
   - Provide enough detail for review (schemas, pseudocode, interaction patterns, trade-offs)
   - Include a checkpoint: invite feedback before moving to the next section
4. **Iterate within section** — refine based on feedback before advancing
5. **Compile to spec** — write a formal spec document with decisions table and scope boundaries
6. **Final approval** — confirm the complete spec before moving to planning/implementation

## Checkpoint Language

After presenting each section, use language that invites refinement:
- "Make sense? Any changes before I move to Section X?"
- "Does this align with what you're imagining? Want me to adjust anything?"
- "Ready for the next part, or should I revisit this section?"

Avoid binary language like "Approved?" — encourage stakeholders to iterate, not just rubber-stamp.

## Anti-Patterns

- **Writing the entire spec first, then asking for feedback** — creates rework when assumptions are wrong
- **Presenting all sections at once without checkpoints** — hard to interrupt; feedback comes too late
- **Skipping the brainstorm phase** — jumping straight to architecture without aligning on goals
- **Sections too granular** — "database" is a good section; "auto-increment IDs" is too small
- **Too little detail per section** — options without recommendations; can't evaluate the design

## Output

Sections compile into a spec document (`docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`) with:
- **Decisions table** — one row per major decision, with context and rationale
- **Scope boundaries** — explicit "in scope" and "explicitly out of scope" sections
- **Section bodies** — 2–4 paragraphs per section; enough detail to drive an implementation plan

## Example Section Outlines

**A daily-puzzle web platform:**
1. Architecture & game abstraction
2. Game logic (generator, solver, rules, uniqueness)
3. Data model & auth
4. API routes & client UI
5. Generation job & testing
6. Scope boundary

**Auth system:**
1. User lifecycle (signup, login, logout, anonymous→registered)
2. Password reset & email verification
3. Session management & reauthentication
4. Security checks (password length, rate limiting)
5. Config & server-side changes
6. Frontend forms & validation
