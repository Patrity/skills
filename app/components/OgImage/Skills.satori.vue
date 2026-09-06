<script setup lang="ts">
/**
 * Skills OG card (1200x630), satori renderer.
 *
 * Adapted from portfolio-v2/app/components/OgImage/TechHive.vue, so the two sites share
 * one social-card language. Satori rules honoured here:
 * - Flexbox only. Every element with more than one child carries an explicit `display: flex`.
 * - `class="flex flex-row|flex-col"` on multi-child containers is deliberate: nuxt-og-image's
 *   flex transformer force-sets `flex-direction: column` on any container whose class does
 *   not contain `flex-`.
 * - satori-html trims text nodes and drops whitespace-only ones, so the title's word spacing
 *   is `column-gap` on per-word spans, not literal spaces.
 * - No `filter: blur()` (satori cannot rasterise it); the glow is a radial-gradient.
 * - Inline <svg> is rasterised from basic shapes and presentation attributes only: no
 *   <style>, <use> or <text>, and the mark is drawn with <path> rather than <polygon>.
 *
 * Fonts come from @nuxt/fonts (Teko, JetBrains Mono, both declared `global`).
 */
import { computed } from 'vue'
import { MARK_ACCENT, MARK_HEXAGON_POINTS, MARK_HEXAGON_STROKE_WIDTH, MARK_SLASH, MARK_SLASH_STROKE_WIDTH, MARK_VIEWBOX } from '~~/shared/brand/mark'
import { fitOgTitle } from '~~/shared/utils/og'

const props = withDefaults(defineProps<{ title?: string }>(), { title: 'Skills' })

// Tokens, dark mode (docs/design/previews/_shared/tokens.css).
const BG = '#0c0c0b'
const FG = '#fafafa'
const DIMMED = '#737373'
const GREEN = '#46c211'
const LATTICE = '#96d76c' // green-300, what the dark hero draws its hairlines in
const LATTICE_HOT = '#46c211'

const FOOTER = 'skills.patrity.com · by TechHive Labs'

// The mark, from the same constants the site and the favicon draw (shared/brand/mark.ts).
const MARK_HEX_PATH = `M${MARK_HEXAGON_POINTS.split(' ').join(' L')} Z`
const MARK_SLASH_PATH = `M${MARK_SLASH.x1},${MARK_SLASH.y1} L${MARK_SLASH.x2},${MARK_SLASH.y2}`

// Satori has no inline spans that wrap across lines, so each word is its own flex item.
const titleWords = computed(() => fitOgTitle(props.title).split(' ').filter(Boolean))

// ---------------------------------------------------------------------------
// Honeycomb: pointy-top hexagons, circumradius 60 (cell 104x120), on the site's
// HiveBackground lattice: x = col*120 (+60 on odd rows), y = row*78.
// ---------------------------------------------------------------------------
const HONEY_W = 1200
const HONEY_H = 630
const HEX_POINTS = [[52, 0], [104, 30], [104, 90], [52, 120], [0, 90], [0, 30]] as const

/** Deterministic PRNG so the bright cells are identical on every build. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface HexCell { d: string, bright: boolean }

const hexCells = computed<HexCell[]>(() => {
  const rand = mulberry32(0x5C1_11A5)
  const cells: HexCell[] = []
  const cols = Math.ceil(HONEY_W / 120) + 1
  const rows = Math.ceil(HONEY_H / 78) + 1
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = col * 120 + (row % 2 === 1 ? 60 : 0)
      const oy = row * 78
      const d = `${HEX_POINTS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${ox + x},${oy + y}`).join(' ')} Z`
      cells.push({ d, bright: rand() < 0.125 })
    }
  }
  return cells
})
</script>

<template>
  <div
    class="flex flex-col"
    :style="{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: BG
    }"
  >
    <!-- Hive lattice -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="HONEY_W"
      :height="HONEY_H"
      :viewBox="`0 0 ${HONEY_W} ${HONEY_H}`"
      :style="{ position: 'absolute', top: '0px', left: '0px', width: `${HONEY_W}px`, height: `${HONEY_H}px` }"
    >
      <path
        v-for="(cell, i) in hexCells"
        :key="i"
        :d="cell.d"
        fill="none"
        :stroke="cell.bright ? LATTICE_HOT : LATTICE"
        :stroke-width="cell.bright ? 1.6 : 1"
        :stroke-opacity="cell.bright ? 0.5 : 0.14"
      />
    </svg>

    <!-- Depth: left-to-right fade so the text side stays solid -->
    <div
      :style="{
        position: 'absolute',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(to right, #0c0c0b 28%, rgba(12,12,11,0.7) 62%, rgba(12,12,11,0.3) 100%)'
      }"
    />
    <!-- Depth: bottom-to-top fade -->
    <div
      :style="{
        position: 'absolute',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%',
        backgroundImage: 'linear-gradient(to top, #0c0c0b 0%, rgba(12,12,11,0) 42%)'
      }"
    />
    <!-- Central energy glow (radial-gradient stands in for the hero's blur) -->
    <div
      :style="{
        position: 'absolute',
        top: '-45px',
        left: '600px',
        width: '720px',
        height: '720px',
        backgroundImage: 'radial-gradient(circle 360px at 360px 360px, rgba(70,194,17,0.18) 0%, rgba(70,194,17,0.07) 40%, rgba(70,194,17,0) 100%)'
      }"
    />

    <!-- Foreground -->
    <div
      class="flex flex-col"
      :style="{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        paddingTop: '56px',
        paddingBottom: '56px',
        paddingLeft: '72px',
        paddingRight: '72px'
      }"
    >
      <!-- Top: mark + wordmark -->
      <div
        class="flex flex-row"
        :style="{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', columnGap: '14px' }"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="52"
          height="52"
          :viewBox="MARK_VIEWBOX"
          :style="{ width: '52px', height: '52px' }"
        >
          <path
            :d="MARK_HEX_PATH"
            fill="none"
            :stroke="FG"
            :stroke-width="MARK_HEXAGON_STROKE_WIDTH"
            stroke-linejoin="round"
          />
          <path
            :d="MARK_SLASH_PATH"
            fill="none"
            :stroke="MARK_ACCENT"
            :stroke-width="MARK_SLASH_STROKE_WIDTH"
            stroke-linecap="round"
          />
        </svg>
        <!--
          font-family / font-weight are STATIC style attributes on purpose: nuxt-og-image
          extracts the fonts an OG component needs from `class` and `style` attributes only
          (a `:style` object literal is invisible to it), and a family whose weights it never
          sees is skipped when it converts @nuxt/fonts' WOFF2 to the TTF satori can read.
        -->
        <span
          style="font-family: Teko; font-weight: 600"
          :style="{ fontSize: '44px', lineHeight: '44px', color: FG }"
        >Skills</span>
      </div>

      <!-- Middle: the title -->
      <div
        class="flex flex-col"
        :style="{ display: 'flex', flexDirection: 'column', maxWidth: '920px' }"
      >
        <div
          class="flex-row"
          style="font-family: Teko; font-weight: 600"
          :style="{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            columnGap: '16px',
            rowGap: '0px',
            fontSize: '72px',
            lineHeight: 0.9,
            letterSpacing: '-1px',
            color: FG
          }"
        >
          <span
            v-for="(word, i) in titleWords"
            :key="i"
            :style="{ color: titleWords.length > 1 && i === titleWords.length - 1 ? GREEN : FG }"
          >{{ word }}</span>
        </div>
      </div>

      <!-- Bottom: the micro-label -->
      <span
        style="font-family: 'JetBrains Mono'; font-weight: 400"
        :style="{
          fontSize: '18px',
          lineHeight: '26px',
          letterSpacing: '3.6px',
          textTransform: 'uppercase',
          color: DIMMED
        }"
      >{{ FOOTER }}</span>
    </div>
  </div>
</template>
