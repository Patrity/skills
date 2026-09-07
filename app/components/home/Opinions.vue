<script setup lang="ts">
/** A run of prose, or a literal the reader will type. */
type Part = string | { code: string }

/**
 * The choices the setup makes, each pointing at the bundle that carries it.
 * Hand-written, not derived: a choice is a claim about the setup, not bundle metadata.
 * The long form lives at /docs/philosophy.
 */
const opinions: { n: string, title: string, body: Part[], to: string }[] = [
  {
    n: '01',
    title: 'Rules and skills stay apart',
    body: ['A rule is a glob and a constraint, and it loads on its own when Claude touches a matching file. A skill is the procedure, and it gets invoked when it is needed. Keeping them apart is what keeps my CLAUDE.md short enough that Claude still reads it. '],
    to: '/skill/nuxt'
  },
  {
    n: '02',
    title: 'Hooks fail closed',
    body: ['I moved the checks I keep forgetting into hooks, so the harness runs them rather than me. Delete a tracked hook script and the wiring exits 2, which is the behaviour I want from a check I rely on. '],
    to: '/skill/quality-hooks'
  },
  {
    n: '03',
    title: 'Docs in three tiers, one of them tested',
    body: ['Handovers, a wiki and frozen specs. The wiki is the tier that rots on me, so a registry names every system and a test fails on a system with no page, or a page nobody registered. '],
    to: '/skill/docs-discipline'
  },
  {
    n: '04',
    title: 'UI work is checked in a browser',
    body: ['Typecheck, lint and unit tests all pass on a component that never mounted, so I drive the change with ', { code: 'playwright-cli' }, ': snapshot, act on refs, assert with ', { code: 'eval' }, ', then read a screenshot. '],
    to: '/skill/browser-testing'
  },
  {
    n: '05',
    title: 'Memory and process are questions',
    body: [
      'These are the habits most likely to be wrong for your project, so the wizard asks instead of assuming. ',
      { code: 'full' },
      ' process is brainstorm, spec, plan, TDD, then a two-stage review, and ',
      { code: 'none' },
      ' is on the list too. Memory is off unless you turn it on. '
    ],
    to: '/skill/iterative-spec-design'
  }
]
</script>

<template>
  <section class="py-12 lg:py-20 border-t border-default">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="max-w-3xl mb-7 lg:mb-10">
        <MicroLabel class="block mb-2.5">
          The choices
        </MicroLabel>
        <h2 class="font-teko font-semibold text-4xl lg:text-[46px] leading-[.9] tracking-[-0.01em] m-0">
          Why the setup looks like this
        </h2>
        <p class="mt-3.5 text-base/[1.65] text-muted">
          These are my choices, and each one is either a question you can answer differently or a bundle you can leave out.
        </p>
      </div>

      <div class="grid gap-6 max-w-[52rem]">
        <article
          v-for="opinion in opinions"
          :key="opinion.n"
          class="grid grid-cols-[3rem_minmax(0,1fr)] gap-5 items-start"
        >
          <span
            class="font-teko font-semibold text-[44px] leading-[.8] text-dimmed"
            aria-hidden="true"
          >{{ opinion.n }}</span>
          <div>
            <h3 class="font-teko font-semibold text-[26px] leading-none tracking-[-0.01em] mt-1.5 mb-2">
              {{ opinion.title }}
            </h3>
            <!--
              No whitespace is added between these: every prose run carries its own trailing
              space, and Vue's condense mode drops the newlines between the tags.
            -->
            <p class="m-0 text-[0.9375rem]/[1.65] text-muted">
              <template
                v-for="(part, i) in opinion.body"
                :key="i"
              >
                <code
                  v-if="typeof part !== 'string'"
                  class="font-mono text-[0.8125rem] text-default"
                >{{ part.code }}</code>
                <span
                  v-else
                >{{ part }}</span>
              </template>
              <NuxtLink
                :to="opinion.to"
                class="font-mono text-[0.8125rem] text-primary no-underline"
              >{{ opinion.to }}</NuxtLink>
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
