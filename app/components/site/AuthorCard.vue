<script setup lang="ts">
/**
 * The author plate that closes a docs page and a bundle README
 * (docs/design/previews/components/author-card.html).
 *
 * The mark stands in for a portrait, so the card costs no image request wherever it lands.
 * The blog link stays in the same tab (it is the other half of the same body of work) while
 * X is a profile and gets the `rel="me"` every other profile link on the site carries.
 */
import { LINKS } from '~~/shared/utils/links'

/** Both chips are the same plate; only the glyph and the label differ. */
const LINK_CLASS = 'inline-flex items-center gap-1.5 rounded-md border border-default px-2.5 py-[0.3125rem] text-[0.8125rem] text-muted no-underline transition-colors hover:border-primary/45 hover:text-primary'
</script>

<template>
  <div
    data-author-card
    class="glass-card flex max-w-[34rem] flex-col items-start gap-3.5 p-5 sm:flex-row sm:gap-5 sm:p-6"
  >
    <span class="grid size-[72px] flex-none place-items-center rounded-xl border-2 border-primary/25">
      <BrandMark :size="40" />
    </span>

    <div>
      <MicroLabel class="block">
        Written by
      </MicroLabel>
      <p class="m-0 mt-1 mb-2 font-teko text-[28px] font-semibold leading-[.9] tracking-[-0.01em] text-default">
        Tony Costanzo
        <span
          class="text-dimmed"
          aria-hidden="true"
        >·</span>
        TechHive Labs
      </p>
      <p class="m-0 mb-3.5 text-sm/[1.6] text-muted">
        I run Claude Code on billion-dollar construction data by day and a rack of GPUs at night, and I write down what breaks. This setup is the part I kept using.
      </p>

      <div class="flex flex-wrap gap-2">
        <a
          :href="LINKS.blog"
          :class="LINK_CLASS"
        >
          Lab notes
          <UIcon
            name="i-lucide-arrow-up-right"
            class="size-[15px]"
          />
        </a>
        <a
          :href="LINKS.x"
          target="_blank"
          rel="me noopener"
          :class="LINK_CLASS"
        >
          <UIcon
            name="i-simple-icons-x"
            class="size-[13px]"
          />
          @Patrity
        </a>
      </div>
    </div>
  </div>
</template>
