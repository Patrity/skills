<script setup lang="ts">
withDefaults(defineProps<{
  /** Append the "by TechHive Labs" micro-label (hidden below md). */
  byline?: boolean
  /** Mark size in px; the wordmark scales with the surrounding type. */
  size?: number
}>(), { byline: false, size: 28 })
</script>

<template>
  <NuxtLink
    to="/"
    class="flex items-center gap-2 text-(--ui-text) no-underline"
  >
    <BrandMark :size="size" />
    <span class="font-teko text-3xl leading-none font-semibold tracking-tight">Skills</span>
    <MicroLabel
      v-if="byline"
      class="hidden md:inline"
    >by TechHive Labs</MicroLabel>
  </NuxtLink>
</template>
