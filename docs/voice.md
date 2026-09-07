# Voice guide

Two registers, one person. The blog is loud, because a war story is allowed to be. This site is
not. skills.patrity.com is one developer sharing the setup he uses, so the copy here is quiet and
plain: first person, understated, no punchlines, no verdicts, and room for the reader to disagree.

Everything below governs the site, the docs, the READMEs and the CLI strings. The blog voice is
described at the bottom, as background, not as a target for this repo.

## The register

1. **First person, plain statements.** "I keep rules and skills apart because.." · "This is what I
   use" · "You might not want this." I say what I do and why. I do not tell the reader what is
   true in general.
2. **No counts that describe the registry.** No "nine bundles", "fourteen questions", "six
   commands", "five opinions", "thirty-one files", "three things". A number survives only inside
   quoted real output (a transcript, a code block) or when it is part of a thing's own name: the
   docs model is still three-tier.
3. **No verdicts, and no this-not-that.** Not "A line in CLAUDE.md is a suggestion. A hook is
   not." Not "Snapshot, act, assert. Then call it done." Not "Evidence means X, not Y." I say what
   the thing does and why I like it, and let the reader draw the line.
4. **Headings describe.** They do not promise and they do not joke. "What the run writes", "The
   bundles", "Commands", "Files a bundle must not own". Never "Six commands, and what each one
   touches".
5. **`..` is the pause mark.** Never an em dash, never an en dash. `grep -rn -- '—\|–'` over the
   copy prints nothing outside quoted real output.
6. **Humanizer pass on every sentence.** `/Users/tony/.claude/skills/humanizer/SKILL.md`. No
   marketing words, no rule of three, no "-ing" tails, no negative parallelism, no filler. Facts
   are exact: flags checked against `cli/src/commands`, paths checked against the repo.
7. **Nothing is lost in the rewrite.** Every command, flag, path and behaviour claim a page made
   before it survives the pass. Only the delivery changes.

## Do and don't

1. **Do open on the thing itself. Don't open on a claim about it.**
   - Before: "Setting up Claude Code properly is surprisingly difficult."
   - After: "This is the Claude Code setup I use on my own projects: a CLAUDE.md, some rules,
     skills and hooks."
2. **Do use `..` for the pause. Don't use an em dash.**
   - Before: "The answer was there all along — on a vendor property."
   - After: "The answer was there all along.. on a vendor property nobody documented."
3. **Do describe, where a count wants to go.**
   - Before: "Nine bundles, fourteen questions, one CLAUDE.md."
   - After: "It is split into bundles so you can take the parts that fit and leave the rest."
4. **Do say what the thing does. Don't rule on it.**
   - Before: "A line in `CLAUDE.md` is a suggestion. A `PreToolUse` hook is not."
   - After: "A `PreToolUse` hook refuses the edit while a line in `CLAUDE.md` asks for it, and I
     wanted the refusal for the checks I keep forgetting."
5. **Do leave the reader a door. Don't close the argument.**
   - Before: "Disagree with one, skip its bundle, and nothing else breaks."
   - After: "These are my choices. Each one is a question you can answer differently or a bundle
     you can leave out."
6. **Do let a section end on a fact. Don't end it on a punch line.**
   - Before: "The model was fine. The config was drunk."
   - After: "The config was wrong, and the model had been fine the whole time."
7. **Do name the tool exactly, with the flag or the version.** `playwright-cli`, `pnpx
   @patrity/skills init --yes --profile nuxt-app`, Node 22 or newer. Never "modern tooling".
8. **Do write to a peer. Don't teach down and don't sell.**
   - Before: "It's important to validate your data before trusting it."
   - After: "I read the file before I trust it, which is why every bundle page shows the files."
9. **Do keep the failure in.** The thing that bit me stays on the page, stated plainly, because it
   is the reason a rule exists. It just does not get a drum roll.
10. **Do keep my own name out of the claim.** No "the setup I actually run" energy in body copy.
    The pages are about the files, not about me being right.
11. **Swearing stays out.** Not even quoted. That is the blog.

## Sample rewrites

### Hero paragraph

> This is the Claude Code setup I use on my own projects: a CLAUDE.md, some rules, skills and
> hooks. It is split into bundles so you can take the parts that fit and leave the rest. The web
> builder and the CLI write the same files.

### A section lede

> These are the choices the setup makes. They are mine, and each one is either a question you can
> answer differently or a bundle you can leave out.

### Docs intro

> A bundle is one slice of a working `.claude/` directory: skills, rules, hooks, settings, and the
> `CLAUDE.md` lines that make them make sense together. It came out of a project that uses it, not
> out of a template.

## Canonical facts

- **Blog / site:** https://www.techhivelabs.net, brand **TechHive Labs**. The blog section is
  "Lab Notes".
- **Signs as:** `author: Tony Costanzo`. The handle everywhere else is **Patrity**
  (github.com/Patrity, x.com/Patrity, bsky patrity.com, `skills.patrity.com`).
- **The `~/` line:** `~/` then `CLAUDE.md · .claude/rules · .claude/skills · .claude/hooks` on this
  site; `full-stack dev · project controls · local AI` on the blog.
- **Recurring props:** four RTX 3090s, vLLM and LiteLLM, EPC and project controls, Thundoria, the
  wife who is judging the GPU budget. They belong to the blog, not to this site.
- **Superpowers:** https://github.com/obra/superpowers . The plugin page is
  https://claude.com/plugins/superpowers . Install it into the user plugins with
  `/plugin install superpowers@claude-plugins-official`.
- **MyMind:** https://github.com/Patrity/mymind , my own open-source memory server. Off by default
  in the questions.

## Where it comes from: the blog voice

Source: 12 posts in `portfolio-v2/content/blog/*.md`. The 2026 posts are the mature blog voice
(`automated-bim-takeoff`, `local-ai-true-cost`, `de-digitizing`, `local-ai-moe-vs-dense`,
`game-server-scaling`, `local-ai-upgrade`, `construction-agents`). The 2025 posts
(`thundoria-architecture`, `q-roguelike`, `vectly-scaling`) are louder and sweary, and they are
juvenilia rather than a target.

What carries over to this site:

- **Short sentences.** Mean around 14 words, median 12 to 14, and roughly one sentence in five
  under six words.
- **`..` as the pause mark, never a dash.** Zero `—` in every 2026 post.
- **Exact, sourced numbers** where an adjective wants to go: "$0.1395/kWh", "the tick time land at
  0.4 milliseconds". On this site the numbers that survive are the ones a run actually printed.
- **Tools named exactly once, with the version or the flag.** "vLLM 0.20.0", `--cpu-moe`.
- **No marketing filler.** Never powerful, seamless, revolutionary, unlock, leverage, empower,
  cutting-edge, game-changing.
- **Second person only to hand over a procedure.** Otherwise "I", and "we" when a team did it.

What stays on the blog:

- **Titles built as a joke.** "I Billed Myself for 6.7 Billion Tokens and the Total Came Out to
  $35.85". Here a heading is a label.
- **The bare punch on its own line.** "1,493 collisions." · "Yikes." A docs page ends on the fact
  instead.
- **Legal and forensic metaphors, blue-collar deflations, the self-deprecating aside.** They are
  the field-report register. This site is the setup, sitting still.
- **Swearing, quoted or implied.**
