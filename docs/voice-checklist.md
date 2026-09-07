# Voice checklist

Tick this before any copy ships. The rules are `docs/voice.md`, "The register" and "Do and don't",
unchanged. Walk it once per surface, not once per pull request. A surface is a page, a doc, a
README, or one command's `--help`.

## The register

- [ ] **1. First person, plain statements.** "I keep rules and skills apart because.." · "This is
  what I use" · "You might not want this." Never a general truth stated on the reader's behalf.
- [ ] **2. No counts that describe the registry.** No "nine bundles", "fourteen questions", "six
  commands", "five opinions", "thirty-one files", "three things". A number survives only inside
  quoted real output or as part of a thing's own name (three-tier docs).
- [ ] **3. No verdicts, and no this-not-that.** Not "A line in CLAUDE.md is a suggestion. A hook is
  not." Say what it does and why I like it.
- [ ] **4. Headings describe.** No promises, no jokes. "Commands", not "Six commands, and what each
  one touches".
- [ ] **5. `..` is the pause mark.** `grep -rn -- '—\|–' <files>` prints nothing outside quoted
  real output.
- [ ] **6. Humanizer pass on every sentence.** `/Users/tony/.claude/skills/humanizer/SKILL.md`.
- [ ] **7. Nothing is lost.** Every command, flag, path and behaviour claim the page carried before
  is still there.

## Do and don't

- [ ] Opens on the thing, not on a claim about it.
- [ ] Where a count wanted to go, there is a description.
- [ ] The reader is left a door: an answer they can change, a bundle they can leave out.
- [ ] Sections end on a fact, not on a punch line.
- [ ] Tools are named exactly, with the flag or the version. Never "modern tooling".
- [ ] Written to a peer. No teaching down, no selling.
- [ ] The failure that caused a rule is still on the page, stated plainly.
- [ ] No swearing, quoted or otherwise.

## Words that fail the pass

- [ ] None of: powerful, seamless, unlock, leverage, empower, revolutionary, cutting-edge,
  game-changing, robust, effortless.
- [ ] No rule of three, no "-ing" tails ("ensuring", "highlighting"), no "It is not just X, it is
  Y", no "at its core", no "let's dive in".
- [ ] Straight quotes, no emoji, no bold used as a bullet header.
- [ ] Average sentence under about 15 words.

## Facts

- [ ] Commands, flags, paths and identifiers are in backticks and checked against the repo:
  `cli/src/commands` for flags, the working tree for paths.
- [ ] Every external link resolves and points where the sentence says it does.

Reference copy for the samples: `docs/voice.md`.
