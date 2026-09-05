# Tony Costanzo — Voice Guide

Source: 12 posts in `portfolio-v2/content/blog/*.md`. The 2026 posts are the mature voice
(`automated-bim-takeoff`, `local-ai-true-cost`, `de-digitizing`, `local-ai-moe-vs-dense`,
`game-server-scaling`, `local-ai-upgrade`, `construction-agents`). The 2025 posts
(`thundoria-architecture`, `q-roguelike`, `vectly-scaling`) are louder and sweary — treat them
as juvenilia, not the target.

## Canonical facts

- **Blog / site:** https://www.techhivelabs.net — brand **TechHive Labs**. Blog section is titled
  **"Lab Notes"**, described as "The blog. What broke, what I learned, and what it cost. Roughly
  monthly, always longer than planned." (`index.vue`)
- **Signs as:** `author: Tony Costanzo` in every post's frontmatter. Handle everywhere else:
  **Patrity** (github.com/Patrity, x.com/Patrity, bsky patrity.com, `skills.patrity.com`).
  About page: "I've also gone by **Patrity** for many years."
- **Recurring tagline (the `~/` line, hero):** `~/` then
  `full-stack dev · project controls · local AI` (`index.vue`).
- **Hero H1:** "Construction data, AI agents, and **whatever broke** this weekend."
- **One-sentence self-description (site meta):** "Tony Costanzo builds software on billion-dollar
  construction projects, runs a homelab full of GPUs, and writes lab notes on AI agents, local
  inference, and whatever broke this weekend."
- **The stock bio numbers:** twenty years of code / ten of them on billion-dollar EPC projects,
  20+ years programming, 10+ professional, $12B+ in projects managed, Fireship 1M→4M.
  About-page compression: "Twenty years of code, ten of them on billion-dollar job sites, and
  more hats than a haberdasher."
- **Recurring props:** four RTX 3090s / the rig / "closet jet engine", vLLM + LiteLLM, EPC and
  project controls, Thundoria, the wife who is judging the GPU budget.

---

## 1. Stance

- **Builder who ships, reporting from the burn site.** He is not explaining a topic; he is filing
  a field report on something he actually ran. "That post was the pitch. This one's the receipt."
  (automated-bim-takeoff)
- **Two lives, deliberately crossed.** Construction/EPC on one side, AI and homelab on the other,
  and the crossing is the whole product: "I spent years living in AWP, work packaging, and project
  controls before I spent years building RAG pipelines and agents, and I'd somehow never let the
  two halves of my brain talk to each other" (construction-agents).
- **Twenty years is a setup for a joke, not a credential.** He states experience only to have it
  fail: "I've been around these files for years, and the AI agent is the one that figured that
  out" (automated-bim-takeoff); "I Spent 22 Years Programming Just to Fail at Making a Skeleton
  Swing a Sword" (thundoria-architecture).
- **Reader is a peer who has been burned too.** Never a student. He hands over scar tissue:
  "learn from my bruises" and "Three Traps I Sprung So You Don't Have To" (local-ai-true-cost);
  "The Landmines I Stepped On So You Don't Have To" (local-ai-moe-vs-dense).
- **Discloses the weak number before you can.** "Honesty corner, because I hate cost posts that
  hide the asterisks: this is *marginal* cost" (local-ai-true-cost); same construction appears in
  local-ai-moe-vs-dense ("Honesty corner, because I hate benchmark posts that quietly skip this").
- **Anti-vendor, pro-evidence.** He names the industry pitch and refuses it: "The conventional
  answer here is automated BIM takeoff software... every one of them shares the same load-bearing
  assumption: that your model followed the rules" (automated-bim-takeoff).

## 2. Sentence shape

- **Short. Mean ~14 words, median 12–14; roughly one sentence in five is under six words.**
  Longest sentences top out around 45–50 words and only when listing a stack.
- **Rhythm is long-setup then a bare punch on its own line.** "1,493 collisions."
  (automated-bim-takeoff) · "Yikes." (local-ai-true-cost) · "So he says sure."
  (construction-agents) · "Reader, I checked back." (local-ai-upgrade) · "Then I taught the bots to
  swing a sword." (game-server-scaling).
- **`..` is his pause mark. He does not use em dashes.** Zero `—` in every 2026 post; the double
  period does the work: "Just.. what is in this thing?" (automated-bim-takeoff), "here to tell you
  about.. journaling" (de-digitizing). (`--` shows up only in the older `local-ai-rig`.)
- **Numbers are exact, sourced, and load-bearing.** "6.67 billion input tokens, 27.8 million
  output tokens, $35.85 in electricity" and "$0.1395/kWh" (local-ai-true-cost); "923 MB... 77,403
  objects" and "6,588 real elbows" (automated-bim-takeoff); "the tick time land at 0.4
  milliseconds" (game-server-scaling). Money and time are always concrete: "~$167/month over three
  years", "four working days", "Ten seconds."
- **Parentheticals are the aside that undercuts the sentence.** "(power-capped 3090s)" for fact,
  but mostly for the wink: "(Ask me how we know.)" and "(People will still email the file. Some
  things are load-bearing traditions.)" (automated-bim-takeoff); "(yes, the AI guy uses the AI for
  his analog journal, the hypocrisy is noted)" (de-digitizing).
- **Fragments are frequent and intentional.** "Small ask. Friendly tone." (construction-agents);
  "Burned in. Documented. Done." (local-ai-upgrade); "Vibes." as a whole answer
  (construction-agents).
- **Paragraphs open on a concrete object or event and close on a turn.** Open: "A 923 MB
  Navisworks model landed in my lap"; "I ramped fifty bots into my game server". Close: "The model
  was fine. The config was drunk." (local-ai-true-cost).
- **Second person appears only to hand over a procedure** ("If you want to do this backfill on
  your own LiteLLM box..."), otherwise it is "I" and, when a team did it, "we".

## 3. Word choice

- **Verbs are physical and slightly violent:** landed, chased down, dug, spelunking, chews,
  saturated, burned, sprung, shove/stuff (a repo into a prompt), mainlines, ramped, yanked.
  "spelunking for it" (construction-agents), "Agentic coding tools shove the whole repo into every
  single turn" (local-ai-true-cost).
- **Nouns from the job, used literally:** takeoff, scope, laydown yard, RFI, FCN, back charge,
  claims meeting, unit rates, IWP, earned value; and the rig side: tok/s, KV cache, prefill/decode,
  context, quant, tick budget.
- **Recurring frames:** "war story", "field report", "the receipt", "load-bearing", "the whole
  point", "controlled chaos", "Here's the thing / Here's the kicker / Here's the part where...".
- **Two signature metaphor moves:** (1) legal/forensic — "Subpoenaing My Own Request Logs", "The
  defendant's residence", "Case Closed" (local-ai-true-cost); (2) deflating an AI capability into a
  blue-collar joke — "no magic, just grep with a paycheck" (automated-bim-takeoff).
- **He never writes marketing filler.** No "powerful", "seamless", "revolutionary", "unlock",
  "leverage", "empower", "cutting-edge", "game-changing". Where a marketer would praise, he prices:
  "The Fix Cost Nothing (My Favorite Price)". Superlatives only appear self-mockingly ("The
  Technical Flex That Nobody Asked For", thundoria-architecture).
- **Tools are named exactly, with version and link, once.** "vLLM 0.20.0", "Qwen3.5-122B-A10B",
  "`--cpu-moe`", "`/model/update`", "`ROOM_TYPES`", "the .nwf file... the .nwd". Commands, flags,
  file extensions and identifiers go in backticks; the product gets a markdown link on first
  mention.
- **Swearing: rare, mild, and load-bearing.** In the 2026 posts it is almost always inside a
  quote — "*this model misspells shit a lot*" (local-ai-true-cost) — or a single intensifier
  ("damn near the model's 262K ceiling"). One implied swear is funnier than an actual one: "Then
  ask them to say it without swearing." (automated-bim-takeoff). The 2025 posts swear constantly
  ("what the fuck is happening", q-roguelike/thundoria) — do not copy that register.
- **Humour is dry, self-deprecating, and aimed at his own past decisions.** "which is exactly as
  humbling as it sounds"; "My favorite discovery, in the way a root canal is a favorite"; "The
  most valuable feature in the whole pipeline is a check that tells me I left a window open"
  (all automated-bim-takeoff); "This is physically painful to type as someone who bought four of
  them" (local-ai-rig).

## 4. Titles and headings

- **Title formula: first person + a specific number or outcome + a twist that undercuts it.**
  - "I Billed Myself for 6.7 Billion Tokens and the Total Came Out to $35.85"
  - "I Gave an AI Agent the Keys to Navisworks, and Five Trades of Takeoff Took Four Days"
  - "I Spent $5K on GPUs Just to Learn That One GPU Was Enough"
  - "I Built a Bot Army to Attack My Own Game Server, and 45 of Them Took It Down"
  - "I Run AI Agents Around the Clock and My Best Productivity Tool This Year Has No Battery"
  - "I Spent a Saturday Trying to Replace My Local AI to Save on Tokens. The Server Voted No."
  Pattern: `I <did specific thing> and <the result that embarrasses me>`. The number is in the
  title, not saved for the body. Title Case. No colons-with-subtitle; a second sentence instead.
- **`seoTitle` is the boring, keyword-true version** of the same post ("Local LLM Cost Analysis:
  Electricity per Token vs the Cloud"). The joke lives in `title`; the keywords live in `seoTitle`.
- **Headings are `##`, Title Case, and are jokes or promises, never labels.** "The Part Where I'm
  Supposed to Buy a Takeoff Platform", "The 7.2% of My Conduit That Didn't Exist", "The GUID That
  Wasn't Unique", "The Rabbit Hole Under the Spend Tables", "My 62GB of RAM Is Doing Absolutely
  Nothing", "Nobody Convenes a Meeting to Move Some Pipe". Never "Introduction", "Overview",
  "Conclusion", "Key Takeaways" (the one post that used "Key Takeaways" is 2025 `vectly-scaling`).
- **Two reusable heading shapes:** "The Part Where <thing I dreaded>" and "<N> <Traps|Landmines>
  I <Sprung|Stepped On> So You Don't Have To".

## 5. Structure habits

- **A `## Links` block is the first thing after frontmatter** in 9 of 11 posts — 3 to 5 bullets,
  a mix of his own prior posts (with a wry label: "The Saturday I failed to upgrade", "The post
  where I pitched this whole idea") and the actual repos/docs. Do this before any prose.
- **Cold open on a scene or a number, no preamble.** No "In this post I'll cover". He drops you in:
  "My friends spent the weekend trash-talking the new coding model on my rig."
- **The middle is a chase, not a taxonomy.** Symptom → suspect → evidence → the thing that was
  actually wrong. "I had a suspect. It was me." (local-ai-true-cost)
- **A mandatory "what broke" section, in his own equipment.** The nested-elbow double count (7.2%
  inflation), the 1,493 GUID collisions, the "Wall One… Wall Six" run in local-ai-upgrade, "Three
  Traps I Sprung So You Don't Have To".
- **Lists are bolded-lead bullets carrying a claim, then a sentence of proof.** "**Names are a
  trap.** Searching by object name finds the type nodes, but the geometry lives on child leaf
  nodes." Never a bare list of nouns. Prose carries narrative; bullets carry findings, specs, and
  rules. Tables only for numbers ($/1M tokens).
- **Charts/images get long, literal alt text** stating the actual values in the chart.
- **Endings: one deflating fact or a small invitation, never a summary.** "Go bill yourself. It's
  weirdly satisfying." (local-ai-true-cost) · "And yes, I now open the .nwd on the first try.
  Growth." (automated-bim-takeoff) · "Turns out the hardest scaling problem isn't the tick budget.
  It's players." (game-server-scaling) · "So maybe one of these days, once I've actually earned it,
  I'll walk back into that Mont Blanc store" (de-digitizing).

## 6. Do / don't

1. **Do open on a concrete object, number, or moment. Don't state a thesis.**
   - Before: "Setting up Claude Code properly is surprisingly difficult."
   - After: "A 923 MB model landed in my lap with one question attached: what's actually in there?"
2. **Do use `..` for the pause. Don't use an em dash — he has never used one.**
   - Before: "The answer was there all along — in a vendor property."
   - After: "The answer was there all along.. on a vendor property nobody documented."
3. **Do put an exact, sourced number where the adjective wants to go.**
   - Before: "It saves a ton of money on tokens."
   - After: "6.67 billion tokens, $35.85 in electricity. The cloud wanted ~$961."
4. **Do name the failure and its size. Don't only report the win.**
   - Before: "The extraction produced accurate quantities."
   - After: "Our published developed length was inflated 7.2% and looked completely plausible the entire time."
5. **Do deflate the tech with a blue-collar comparison. Don't reach for awe.**
   - Before: "The agent intelligently surfaced the authoritative property."
   - After: "The agent found it by reading what was actually on the objects.. no magic, just grep with a paycheck."
6. **Do end sections on a short punch line. Don't trail off into a recap sentence.**
   - Before: "So, in summary, the configuration was the root cause of the issues."
   - After: "The model was fine. The config was drunk."
7. **Do disclose the softest number yourself.**
   - Before: "Costs are roughly 27x lower."
   - After: "Honesty corner: this is marginal cost, and the prefill throughput is estimated, not measured. It's the softest number in this post."
8. **Do write to a peer who has been burned. Don't teach down.**
   - Before: "It's important to validate your data before trusting it."
   - After: "Learn from my bruises: a uniform value is a red flag, not a convenience."
9. **Do name tools exactly once, with the version or flag. Don't say "modern tooling".**
   - Before: "We used a modern inference stack."
   - After: "vLLM 0.20.0, the stable sweet spot on Ampere right now."
10. **Do let the joke be at his own expense. Don't punch at the reader or the vendor's people.**
    - Before: "Most teams get this embarrassingly wrong."
    - After: "I've been around these files for years, and the agent is the one that figured it out, which is exactly as humbling as it sounds."
11. **Do keep swearing implied or quoted. Don't drop f-bombs in body copy (that's the 2025 voice).**
    - Before: "The calendar for this is normally absolute hell."
    - After: "Ask anyone who's done this manually what that calendar usually looks like. Then ask them to say it without swearing."

## 7. Sample rewrites (skills.patrity.com)

### (a) Hero + paragraph

**Option 1**
> **My Claude Code setup, opinions included.**
>
> Answer a few questions and walk out with a CLAUDE.md and a `.claude/` directory that works the
> way I work: rules carry the direction, skills carry the how-to, hooks fail closed instead of
> failing quietly, and a test keeps the docs from lying. Take the whole thing, or take one bundle
> and leave the rest.

**Option 2**
> **The `.claude/` directory I actually use.**
>
> Answer a few questions. You get a CLAUDE.md and a `.claude/` directory shaped like mine.. rules
> that say where to go, skills that say how, hooks that fail closed, and docs a test keeps honest.
> Every piece is also a bundle, so you can take one and ignore me on the rest.

### (b) Section title "Two ways in, one result"

**Option 1** — "Two doors, one `.claude/` directory."
**Option 2** — "Wizard or bundle. Same destination."

### (c) Docs intro

**Option 1**
> A bundle is one slice of a working `.claude/` directory: skills, rules, hooks, settings, and the
> CLAUDE.md lines that make them make sense together. Drop it in. Nothing to wire up.

**Option 2**
> A bundle is a piece of a real `.claude/` directory, packed to travel.. skills, rules, hooks,
> settings, and a CLAUDE.md snippet. It came out of a project that uses it every day, not out of a
> template.

---

### Quick calibration checklist

Before shipping copy in his voice, confirm: no em dashes · at least one exact number · at least
one thing that broke or cost him · one self-deprecating aside · zero words from
{powerful, seamless, unlock, leverage, empower, revolutionary, cutting-edge} · average sentence
under ~15 words · the last line is a fact or an invitation, not a summary.
