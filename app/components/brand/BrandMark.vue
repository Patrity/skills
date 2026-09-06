<script setup lang="ts">
import {
  MARK_ACCENT,
  MARK_HEXAGON_POINTS,
  MARK_HEXAGON_STROKE_WIDTH,
  MARK_SLASH,
  MARK_SLASH_STROKE_WIDTH,
  MARK_VIEWBOX
} from '~~/shared/brand/mark'

// Geometry lives in shared/brand/mark.ts so the site, the favicon and the OG card
// cannot drift apart. The outline inherits currentColor; the slash never changes.
withDefaults(defineProps<{ size?: number }>(), { size: 40 })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="MARK_VIEWBOX"
    :width="size"
    :height="size"
    class="shrink-0 text-(--ui-text)"
    aria-hidden="true"
  >
    <polygon
      :points="MARK_HEXAGON_POINTS"
      fill="none"
      stroke="currentColor"
      :stroke-width="MARK_HEXAGON_STROKE_WIDTH"
      stroke-linejoin="round"
    />
    <line
      :x1="MARK_SLASH.x1"
      :y1="MARK_SLASH.y1"
      :x2="MARK_SLASH.x2"
      :y2="MARK_SLASH.y2"
      :stroke="MARK_ACCENT"
      :stroke-width="MARK_SLASH_STROKE_WIDTH"
      stroke-linecap="round"
    />
  </svg>
</template>
