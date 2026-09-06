<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'

const props = defineProps<{
  /** In the order /api/skills returns them, which is the order the CLI installs them (slug, ascending). */
  bundles: SkillSummary[]
}>()

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

/** Spelled out up to twenty, digits above that. */
const count = computed(() => WORDS[props.bundles.length] ?? String(props.bundles.length))
const label = computed(() => `${count.value.charAt(0).toUpperCase()}${count.value.slice(1)} bundles`)
</script>

<template>
  <section class="py-12 lg:py-20 border-t border-default">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="max-w-3xl mb-7 lg:mb-10">
        <MicroLabel class="block mb-2.5">
          {{ label }}
        </MicroLabel>
        <h2 class="font-teko font-semibold text-4xl lg:text-[46px] leading-[.9] tracking-[-0.01em] m-0">
          {{ label }}, in the order they install.
        </h2>
        <p class="mt-3.5 text-base/[1.65] text-muted">
          Every one of them is also a zip you can take on its own, with the CLAUDE.md lines that make it make sense.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <NuxtLink
          v-for="bundle in bundles"
          :key="bundle.slug"
          :to="`/skill/${bundle.slug}`"
          class="group glass-card grid grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[34px_minmax(0,1fr)] gap-3 md:gap-4 items-start p-4 md:p-5 no-underline hover:border-primary/30 hover:shadow-[0_0_30px_rgba(70,194,17,0.12)] transition"
        >
          <BrandMark
            :size="34"
            class="mt-0.5 w-7 h-7 md:w-[34px] md:h-[34px]"
          />
          <div>
            <h3 class="font-teko font-semibold text-2xl md:text-[28px] leading-[.9] tracking-[-0.01em] m-0 mb-1.5 text-default group-hover:text-primary transition-colors">
              {{ bundle.name }}
            </h3>
            <p class="m-0 mb-2.5 text-sm/[1.55] text-muted">
              {{ bundle.description }}
            </p>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-for="tag in bundle.tags"
                :key="tag"
                class="inline-flex items-center px-2 rounded-full border border-default font-mono text-[0.6875rem]/[1.7] text-muted"
              >{{ tag }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <div class="mt-8">
        <NuxtLink
          to="/skills"
          class="glow inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-default font-semibold text-[0.9375rem] text-default hover:border-primary/45 transition-colors"
        >
          Open one and read the files
          <UIcon
            name="i-lucide-arrow-right"
            class="size-4"
          />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
