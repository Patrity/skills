<script setup lang="ts">
import type { Transcript } from '~~/shared/types/site'
import transcript from '~/assets/transcripts/init.json'

/**
 * The home hero: identity column on the left, a typing `init` transcript on the right.
 *
 * Mirrors the blog hero on techhivelabs.net (full-height stage, reactive hive, two depth
 * veils, central glow) with the lattice drawn by <HiveBackground> rather than the
 * frozen SVG the mockup used. Markup follows docs/design/previews/pages/home.html.
 */
const props = defineProps<{
  /** Bundles in the registry, for the status pill. */
  bundleCount: number
  /** Questions the wizard can ask. 0 when /api/base could not be read; the pill drops that half. */
  axisCount: number
}>()

const pill = computed(() => {
  const bundles = `${props.bundleCount} bundle${props.bundleCount === 1 ? '' : 's'}`
  if (!props.axisCount) return bundles
  return `${bundles} · ${props.axisCount} question${props.axisCount === 1 ? '' : 's'}`
})

/**
 * Read times, from `wc -w content/docs/<slug>.md / 220` on 2026-09-06 (652 → 3, 812 → 4).
 * The markdown is a Nitro server asset, so the page cannot count the words without either
 * an API round trip or bundling both docs into the client; neither is worth two integers.
 */
const docRows = [
  { to: '/docs/start-here', title: 'Start here', minutes: 3 },
  { to: '/docs/philosophy', title: 'Philosophy', minutes: 4 }
]

// ─── The typing transcript ─────────────────────────────────────────────────
// A real `pnpm dlx @patrity/skills init --yes --profile nuxt-app --json` run, captured
// 2026-09-06: 31 files, the middle 18 elided. JSON widens `type` to string, hence the cast.
const { lines } = transcript as unknown as Transcript

/** Pause on the finished frame before the run replays. */
const PAUSE_MS = 6000

/** `cmd` lines cost `delay` per character; the rest appear whole after `delay`. */
const durations = lines.map(line => (line.type === 'cmd' ? line.text.length * line.delay : line.delay))
const starts: number[] = []
let clock = 0
for (const duration of durations) {
  starts.push(clock)
  clock += duration
}
const TOTAL_MS = clock
const CYCLE_MS = TOTAL_MS + PAUSE_MS

const full = () => lines.map(line => line.text.length)

/** Characters revealed per line. Starts finished, so SSR and no-JS render the whole run. */
const shown = ref<number[]>(full())

/** The caret trails the last line with anything on it. */
const caretLine = computed(() => {
  for (let i = shown.value.length - 1; i >= 0; i--) if (shown.value[i]!) return i
  return 0
})

function frameAt(elapsed: number): number[] {
  return lines.map((line, i) => {
    const from = elapsed - starts[i]!
    if (from <= 0) return 0
    if (line.type !== 'cmd') return from >= line.delay ? line.text.length : 0
    return Math.min(line.text.length, Math.floor(from / line.delay))
  })
}

const preRef = ref<HTMLElement | null>(null)
let raf = 0
let origin = 0
let reduced = false
let onScreen = true
let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const next = frameAt(Math.min((now - origin) % CYCLE_MS, TOTAL_MS))
  // Most frames reveal nothing new; re-rendering sixteen lines anyway is pure waste.
  if (next.every((n, i) => n === shown.value[i])) return
  shown.value = next
}

function play() {
  if (raf || reduced || !onScreen) return
  origin = performance.now()
  raf = requestAnimationFrame(tick)
}

/** Anything that turns the animation off leaves the finished run on screen, never a blank box. */
function freeze() {
  stop()
  shown.value = full()
}

function onMotionChange() {
  reduced = motionQuery?.matches ?? false
  if (reduced) freeze()
  else play()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)

  // Off-screen the run is invisible, so it should not be burning frames either.
  if (typeof IntersectionObserver !== 'undefined' && preRef.value) {
    observer = new IntersectionObserver((entries) => {
      onScreen = entries.some(e => e.isIntersecting)
      if (onScreen) play()
      else freeze()
    })
    observer.observe(preRef.value)
  } else {
    play()
  }
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  motionQuery?.removeEventListener('change', onMotionChange)
})
</script>

<template>
  <section class="relative isolate flex items-center min-h-dvh overflow-hidden border-b border-default">
    <HiveBackground energy="full" />

    <!--
      Light-only green wash off the top-left corner (the dark hero keeps the glow alone).
      An inline style because the gradient's color-mix() does not survive Tailwind's
      arbitrary-value escaping; same escape hatch <HiveBackground> uses for its glow.
    -->
    <div
      class="absolute inset-0 -z-10 pointer-events-none dark:hidden"
      style="background: radial-gradient(700px 420px at 12% 10%, color-mix(in srgb, var(--color-green-400) 16%, transparent), transparent 70%);"
      aria-hidden="true"
    />

    <div class="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 lg:px-8 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
      <!-- Identity column. -->
      <div class="lg:col-span-7 max-w-3xl">
        <span class="glass-card rounded-full inline-flex items-center gap-2 mb-6 px-4 py-1.5 text-sm text-primary">
          <span
            class="size-2 shrink-0 rounded-full bg-primary"
            aria-hidden="true"
          />
          {{ pill }}
        </span>

        <h1 class="font-teko font-bold text-5xl lg:text-[6rem] leading-[.86] tracking-[-0.025em] text-default">
          Claude Code,<br>
          set up the way<br>
          I <span class="gradient-text">actually</span><br>
          run it.
        </h1>

        <p class="flex items-baseline gap-2 mt-6 font-mono">
          <span
            class="text-sm text-(--color-green-500) opacity-60"
            aria-hidden="true"
          >~/</span>
          <!-- The approved 375 mockup drops the .claude/ prefixes rather than wrapping the line. -->
          <span class="sm:hidden text-base text-default">CLAUDE.md · rules · skills · hooks</span>
          <span class="hidden sm:inline text-base lg:text-lg text-default">CLAUDE.md · .claude/rules · .claude/skills · .claude/hooks</span>
        </p>

        <p class="mt-4 max-w-xl text-base/relaxed lg:text-lg/relaxed text-muted">
          Nine bundles, fourteen questions, one CLAUDE.md. Take the whole setup or one bundle.. every run writes the same files the CLI would, and the lockfile remembers which.
        </p>

        <div class="flex flex-wrap items-center gap-3 lg:gap-4 mt-7">
          <NuxtLink
            to="/build"
            class="glow inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold bg-(--color-green-500) text-white hover:bg-(--color-green-600) transition-colors"
          >
            Build it on the web
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4.5"
            />
          </NuxtLink>
          <NuxtLink
            to="/docs"
            class="glow inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold border border-default text-default hover:border-primary/45 transition-colors"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-4.5"
            />
            Read the docs
          </NuxtLink>
        </div>

        <InstallBox
          command="pnpx @patrity/skills init"
          slug="init"
          class="mt-4 max-w-xl"
        />

        <div class="flex items-center gap-4 mt-9">
          <MicroLabel>Find me</MicroLabel>
          <span
            class="w-8 h-px shrink-0 bg-(--ui-border)"
            aria-hidden="true"
          />
          <SocialLinks />
        </div>
      </div>

      <!-- What the run writes. -->
      <div class="lg:col-span-5 flex flex-col gap-4">
        <MicroLabel>What init writes</MicroLabel>

        <!--
          `dark` is not decoration: the transcript keeps its terminal colours in both modes,
          and the class re-points every --ui-* token inside the card at the dark palette.
        -->
        <div class="dark relative min-h-80 lg:min-h-[26rem] rounded-xl overflow-hidden bg-default ring-1 ring-(--ui-border)">
          <div class="flex items-center justify-between gap-4 px-3.5 py-2 border-b border-default">
            <span
              class="flex gap-1.5"
              aria-hidden="true"
            >
              <i
                v-for="dot in 3"
                :key="dot"
                class="size-2.5 rounded-full bg-(--ui-border)"
              />
            </span>
            <span class="font-mono text-xs text-dimmed">~/acme-web</span>
          </div>

          <pre
            ref="preRef"
            class="m-0 px-4 pt-3.5 pb-38 font-mono text-[13px] leading-[1.6] text-muted whitespace-pre overflow-hidden [font-variant-ligatures:none]"
          ><span
            v-for="(line, i) in lines"
            :key="i"
            class="block min-h-[1.6em]"
          ><template v-if="line.type === 'cmd'"><span class="text-(--color-green-500)">$</span> <span class="text-default">{{ line.text.slice(0, shown[i]) }}</span></template><span
            v-else
            :class="line.type === 'ok' ? 'text-(--color-green-400)' : line.dim ? 'text-dimmed' : ''"
          >{{ line.text.slice(0, shown[i]) }}</span><span
            v-if="i === caretLine"
            class="inline-block w-2 h-[1em] align-[-2px] ml-1 bg-(--color-green-400)"
            aria-hidden="true"
          /></span></pre>

          <div class="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pt-16 pb-5 bg-linear-to-t from-[rgba(12,12,11,0.95)] via-[rgba(12,12,11,0.5)] to-transparent">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="chip in ['init', 'nuxt-app']"
                :key="chip"
                class="inline-flex items-center px-2 rounded-full font-mono text-[0.6875rem]/[1.7] text-(--color-green-300) bg-primary/15"
              >{{ chip }}</span>
            </div>
            <p class="m-0 text-xl/[1.35] font-semibold text-white">
              31 files land in the repo, and the lockfile lists every one.
            </p>
            <p class="m-0 font-mono text-xs text-dimmed">
              pnpx @patrity/skills init · --yes --profile nuxt-app
            </p>
          </div>
        </div>

        <MicroLabel>Start here</MicroLabel>
        <NuxtLink
          v-for="row in docRows"
          :key="row.to"
          :to="row.to"
          class="group flex items-center gap-3.5 no-underline"
        >
          <span class="thumb dark w-26 h-16 shrink-0 grid place-items-center rounded-lg bg-default ring-1 ring-(--ui-border)">
            <BrandMark :size="30" />
          </span>
          <span class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm font-semibold leading-tight text-default group-hover:text-primary transition-colors">{{ row.title }}</span>
            <span class="text-xs text-dimmed">{{ row.minutes }} min read</span>
          </span>
        </NuxtLink>
      </div>
    </div>

    <a
      href="#writes"
      class="absolute left-1/2 bottom-6 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-dimmed hover:text-primary transition-colors"
    >
      <MicroLabel>Scroll</MicroLabel>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4.5"
      />
    </a>
  </section>
</template>

<style scoped>
/*
  <BrandMark> pins its outline to --ui-text so it reads on any page background; inside the
  black doc-row thumb the approved design wants the whole mark in green-400 instead.
*/
.thumb :deep(svg) {
  color: var(--color-green-400);
}
</style>
