<script setup lang="ts">
import { SOCIALS } from '~~/shared/utils/links'

const props = withDefaults(defineProps<{
  /** Restrict to these labels; order stays SOCIALS order. Omit for all four. */
  only?: readonly string[]
}>(), { only: undefined })

const items = computed(() => (props.only ? SOCIALS.filter(s => props.only!.includes(s.label)) : SOCIALS))
</script>

<template>
  <div class="flex items-center gap-0.5">
    <!--
      `rel="me"` is the identity claim the profiles verify against (spec §6); `noopener`
      because they open in a new tab. Plain <a>, not <ULink>: these never route.
    -->
    <a
      v-for="social in items"
      :key="social.label"
      :href="social.href"
      target="_blank"
      rel="me noopener"
      :aria-label="social.label"
      class="inline-flex p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
    >
      <UIcon
        :name="social.icon"
        class="size-4"
      />
    </a>
  </div>
</template>
