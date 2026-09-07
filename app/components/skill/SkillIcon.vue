<script setup lang="ts">
/**
 * The glyph in front of a bundle's name.
 *
 * A bundle may name its own icon in frontmatter (`icon:`, lucide or simple-icons only,
 * validated in server/lib/skills/frontmatter.ts). Without one it keeps the brand mark, so
 * every row is laid out the same either way: one square box of `size`, in the accent.
 *
 * `size` sets the box; a caller that scales with the viewport passes width/height classes
 * on top (they win over the inline font-size the icon renders with).
 */
defineProps<{
  icon?: string
  size: number
}>()
</script>

<template>
  <UIcon
    v-if="icon"
    :name="icon"
    :size="size"
    :data-skill-icon="icon"
    class="shrink-0 text-primary"
  />
  <BrandMark
    v-else
    :size="size"
    data-skill-icon="mark"
  />
</template>
