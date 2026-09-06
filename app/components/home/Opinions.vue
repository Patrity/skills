<script setup lang="ts">
/** A run of prose, or a literal the reader will type. */
type Part = string | { code: string }

/**
 * The five opinions the setup encodes, each pointing at the bundle that enforces it.
 * Hand-written, not derived: an opinion is a claim about the setup, not bundle metadata.
 * The long form lives at /docs/philosophy.
 */
const opinions: { n: string, title: string, body: Part[], to: string }[] = [
  {
    n: '01',
    title: 'Rules carry the direction, skills carry the how-to',
    body: ['A rule is a glob and a constraint that loads on its own. A skill is the procedure, and it has to be invoked. Splitting them is what keeps CLAUDE.md short enough that Claude still reads it. '],
    to: '/skill/nuxt'
  },
  {
    n: '02',
    title: 'Hooks fail closed',
    body: ['A line in CLAUDE.md is a suggestion. A PreToolUse hook is not. Delete a tracked hook script and the wiring exits 2 rather than waving the edit through. '],
    to: '/skill/quality-hooks'
  },
  {
    n: '03',
    title: 'Docs come in three tiers, and one of them is tested',
    body: ['The wiki is the tier that rots. A registry names every system, and the test fails on a page nobody registered, so drift shows up red in the commit that caused it. '],
    to: '/skill/docs-discipline'
  },
  {
    n: '04',
    title: 'UI work is proven in a real browser',
    body: ['Typecheck, lint and unit tests all pass on a component that never mounted. Snapshot, act on refs, assert with eval, read a screenshot. Then call it done. '],
    to: '/skill/browser-testing'
  },
  {
    n: '05',
    title: 'Memory and process are opt-in',
    body: [
      'The two habits most likely to be wrong for your project are questions, not defaults. ',
      { code: 'full' },
      ' process is brainstorm, spec, plan, TDD, then a two-stage review; ',
      { code: 'none' },
      ' is also on the list. '
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
          The opinions
        </MicroLabel>
        <h2 class="font-teko font-semibold text-4xl lg:text-[46px] leading-[.9] tracking-[-0.01em] m-0">
          Five opinions, and the bundle that holds each one up.
        </h2>
        <p class="mt-3.5 text-base/[1.65] text-muted">
          They are mine and they are separable. Disagree with one, skip its bundle or its answer, and nothing else breaks.
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
