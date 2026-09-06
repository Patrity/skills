# Voice checklist

Tick this before any copy ships. The rules are `docs/voice.md` §6, unchanged, plus the calibration
line at the bottom. Eleven rules, not ten: §6 grew a swearing rule after the first draft.

Walk it once per surface, not once per pull request. A surface is a page, a doc, a README, or one
command's `--help`.

## The eleven

- [ ] **1. Opens on a concrete object, number, or moment.** No thesis sentence.
  Not "Setting up Claude Code properly is surprisingly difficult."
  Try "A 923 MB model landed in my lap with one question attached: what's actually in there?"
- [ ] **2. `..` is the pause mark.** No em dash, no en dash, anywhere.
  `grep -rn -- '—\|–' <files>` prints nothing.
- [ ] **3. An exact, sourced number sits where the adjective wanted to go.**
  Not "saves a ton of money". Try "6.67 billion tokens, $35.85 in electricity."
- [ ] **4. The failure is named, and so is its size.** Not only the win.
  "Our published developed length was inflated 7.2% and looked plausible the entire time."
- [ ] **5. The tech is deflated with a blue-collar comparison.** No awe.
  "no magic, just grep with a paycheck."
- [ ] **6. Every section ends on a short punch line.** No recap sentence.
  Not "So, in summary, the configuration was the root cause."  Try "The model was fine. The config was drunk."
- [ ] **7. The softest number is disclosed by me, first.**
  "Honesty corner: this is marginal cost, and the prefill throughput is estimated."
- [ ] **8. Written to a peer who has been burned.** Never teaching down.
  "Learn from my bruises: a uniform value is a red flag, not a convenience."
- [ ] **9. Tools are named exactly once, with the version or the flag.** Never "modern tooling".
  "vLLM 0.20.0, the stable sweet spot on Ampere right now."
- [ ] **10. The joke is at my own expense.** Never at the reader or at a vendor's people.
- [ ] **11. Swearing stays implied or quoted.** No f-bombs in body copy; that is the 2025 voice.

## Calibration line

- [ ] Zero em dashes.
- [ ] At least one exact number.
- [ ] At least one thing that broke or cost something.
- [ ] One self-deprecating aside.
- [ ] Zero words from {powerful, seamless, unlock, leverage, empower, revolutionary, cutting-edge}.
- [ ] Average sentence under about 15 words.
- [ ] The last line is a fact or an invitation, never a summary.

## Headings

- [ ] Every `##` promises something or makes a joke. Never "Introduction", "Overview",
  "Conclusion", "Key Takeaways".
- [ ] Commands, flags, paths and identifiers are in backticks.

Reference copy for the samples above: `docs/voice.md`.
