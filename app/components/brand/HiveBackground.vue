<script setup lang="ts">
/**
 * HiveBackground: a reactive honeycomb drawn on a <canvas>.
 *
 * Ported from techhivelabs.net (portfolio-v2/app/components/HiveBackground.vue): same
 * author, same licence, with one addition: the `energy` prop, which dims the hive for
 * the tool pages (`low` runs the idle breathing and the hot colour blend at 40%).
 *
 * The wrapper and the <canvas> render on the server so the box is reserved and nothing
 * shifts on hydration; every line of DOM, pointer and RAF work runs inside onMounted.
 *
 * Same geometry and overlays as the original static SVG honeycomb (HeroBackground.vue,
 * retired in the round-2 refresh), but the cells respond:
 *  - hovering excites nearby cells and the "signal" spreads to neighbours on a
 *    fixed tick while all energy decays continuously
 *  - ~13% of cells breathe when idle, and a random cell sparks every few
 *    seconds when the pointer has been still
 *  - honours prefers-reduced-motion (static grid, no listeners, no RAF)
 *  - SSR safe: all DOM work happens in onMounted, everything is torn down in
 *    onBeforeUnmount
 */

// ─── Geometry (matches the original SVG grid: 104x120 hex path on a 120x78 lattice) ─
const HEX_RADIUS = 60 // pointy-top circumradius; vertices at (60k - 90)°
const STRIDE_X = 120 // centre-to-centre horizontal distance
const STRIDE_Y = 78 // centre-to-centre row distance
const ROW_OFFSET = 60 // odd rows shift right by half a stride
const ORIGIN_X = 52 // centre of the first cell (SVG hex was 104×120 with top-left at 0,0)
const ORIGIN_Y = 60
const NEIGHBOUR_RADIUS = 128 // cells closer than this are neighbours (= the 6 hex neighbours)

// ─── Dynamics ──────────────────────────────────────────────────────────────
const PROPAGATION = 0.58 // neighbour target = 0.58 × hottest neighbour, only rises
const RISE_PER_SECOND = 14 // how fast a cell approaches that target (~70ms time constant)
const DECAY_PER_SECOND = 1.7
const MAX_DT = 0.05 // clamp frame delta (tab switches, hitches)
const HOVER_RADIUS = 70 // px from the pointer that gets excited
const HOVER_FALLOFF = 90 // e = 1 - d / HOVER_FALLOFF
const IDLE_RATIO = 0.13 // share of cells that breathe
const BREATHE_PERIOD_MS = 4000
const IDLE_AFTER_MS = 2500 // pointer must be still this long before sparks fire
const FIRST_SPARK_MS = 1500
const SPARK_MIN_MS = 2200
const SPARK_RANGE_MS = 3000
const RESIZE_DEBOUNCE_MS = 150
const MAX_DPR = 2

// ─── Colours (green-500 / green-600 / green-800 of the site palette) ────────
const HOT_RGB = '70,194,17'

/** How much of the idle breathing and the hot colour blend each mode draws. */
const ENERGY_SCALE = { full: 1, low: 0.4 } as const

interface Cell {
  x: number
  y: number
  /** current energy 0..1 */
  e: number
  /** breathing cell */
  idle: boolean
  /** breathing phase offset (radians) */
  ph: number
  /** indices of neighbouring cells */
  n: number[]
}

interface Grid {
  width: number
  height: number
  cols: number
  rows: number
  cells: Cell[]
  /** scratch buffer for the propagation step */
  scratch: Float32Array
}

/**
 * Deterministic per-cell random in [0, 1). Keyed by (seed, row, col, salt) so a
 * resize adds/removes cells without reshuffling which ones breathe; the seed is
 * chosen once per mount so each page load still looks different.
 */
function cellRandom(seed: number, row: number, col: number, salt: number): number {
  let h = (seed ^ Math.imul(row + 1, 0x9E3779B1) ^ Math.imul(col + 1, 0x85EBCA77) ^ Math.imul(salt + 1, 0xC2B2AE3D)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7FEB352D)
  h = Math.imul(h ^ (h >>> 15), 0x846CA68B)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Build the cell grid for a canvas of `width`×`height` CSS pixels. */
function buildGrid(width: number, height: number, seed: number, previous: Grid | null): Grid {
  const cols = Math.ceil(width / STRIDE_X) + 2
  const rows = Math.ceil(height / STRIDE_Y) + 2
  const cells: Cell[] = new Array<Cell>(rows * cols)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // carry energy over from the previous grid so a resize doesn't go dark
      let e = 0
      if (previous && r < previous.rows && c < previous.cols) {
        e = previous.cells[r * previous.cols + c]?.e ?? 0
      }
      cells[r * cols + c] = {
        x: c * STRIDE_X + (r % 2 ? ROW_OFFSET : 0) + ORIGIN_X,
        y: r * STRIDE_Y + ORIGIN_Y,
        e,
        idle: cellRandom(seed, r, c, 0) < IDLE_RATIO,
        ph: cellRandom(seed, r, c, 1) * Math.PI * 2,
        n: []
      }
    }
  }

  // Neighbours: any cell whose centre is within NEIGHBOUR_RADIUS. Rows further
  // than ±1 apart are ≥ 2×STRIDE_Y = 156px away, so only scan adjacent rows.
  const r2 = NEIGHBOUR_RADIUS * NEIGHBOUR_RADIUS
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const row = Math.floor(i / cols)
    const jStart = Math.max(0, row - 1) * cols
    const jEnd = Math.min(rows, row + 2) * cols
    for (let j = jStart; j < jEnd; j++) {
      if (j === i) continue
      const other = cells[j]!
      const dx = cell.x - other.x
      const dy = cell.y - other.y
      if (dx * dx + dy * dy < r2) cell.n.push(j)
    }
  }

  return { width, height, cols, rows, cells, scratch: new Float32Array(cells.length) }
}

/**
 * Propagation, run every frame: each cell eases toward 0.58 × its hottest neighbour
 * (only upward). Easing per frame instead of snapping on a fixed tick is what keeps the
 * outer edge of the glow from flickering: a tick-based rise fighting continuous decay
 * produced a sawtooth right at the visibility threshold, and cells there popped in and out.
 */
function propagate(grid: Grid, dt: number): void {
  const { cells, scratch } = grid
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    let best = 0
    for (let k = 0; k < cell.n.length; k++) {
      const e = cells[cell.n[k]!]!.e
      if (e > best) best = e
    }
    scratch[i] = best * PROPAGATION
  }
  const k = 1 - Math.exp(-dt * RISE_PER_SECOND)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const target = scratch[i]!
    if (target > cell.e) cell.e += (target - cell.e) * k
  }
}

/** Smoothstep 0..1 over [lo, hi]. */
function smooth(x: number, lo: number, hi: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}
const HOT = [70, 194, 17] as const
const BREATHE_C = [57, 161, 14] as const
const REST = [29, 82, 10] as const
function mix(a: readonly [number, number, number], b: readonly [number, number, number], t: number): string {
  return `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath()
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 90) * Math.PI) / 180
    const px = x + radius * Math.cos(a)
    const py = y + radius * Math.sin(a)
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, dpr: number, now: number, energy: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, grid.width, grid.height)
  ctx.lineJoin = 'round'

  const breathePhase = (now / BREATHE_PERIOD_MS) * Math.PI * 2
  const cells = grid.cells
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const e = cell.e
    // `energy` scales the breathing contribution only: a low-energy hive still draws
    // every cell at its resting alpha, it just breathes and warms less.
    const breathe = (cell.idle ? 0.5 + 0.5 * Math.sin(breathePhase + cell.ph) : 0) * energy
    const base = cell.idle ? 0.2 + 0.4 * breathe : 0.15
    const alpha = Math.min(1, base + e * 0.9)
    const width = (cell.idle ? 1 + breathe : 0.5) + e * 1.6

    hexPath(ctx, cell.x, cell.y, HEX_RADIUS)
    // Everything below is a continuous function of e: colour blends rest→hot, the glow and the
    // fill scale with e from zero. No threshold anywhere, so nothing can pop at the frontier.
    const heat = smooth(e, 0, 0.45) * energy
    const rgb = mix(cell.idle ? BREATHE_C : REST, HOT, heat)
    ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`
    if (e > 0.015) {
      ctx.shadowColor = `rgba(${HOT_RGB},${(0.9 * heat).toFixed(3)})`
      ctx.shadowBlur = 18 * e
      ctx.fillStyle = `rgba(${HOT_RGB},${(e * 0.1).toFixed(3)})`
      ctx.fill()
    } else {
      ctx.shadowBlur = 0
    }
    ctx.lineWidth = width
    ctx.stroke()
  }
  ctx.shadowBlur = 0
}

// ─── Component ─────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  /** `full` for the home hero, `low` for the tool pages. */
  energy?: 'full' | 'low'
}>(), { energy: 'full' })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

let dispose: (() => void) | null = null

/** Wire the hive up to a mounted canvas. Returns a teardown function. */
function startHive(canvas: HTMLCanvasElement): (() => void) | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Read once per mount: the prop is set by the page, not animated.
  const energy = ENERGY_SCALE[props.energy]

  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const seed = (Math.random() * 4294967296) >>> 0

  let width = 0
  let height = 0
  let dpr = 1
  let grid: Grid | null = null

  /** Sync the backing store to the element's CSS size. Returns true if it changed. */
  function fit(): boolean {
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    if (w === width && h === height && nextDpr === dpr) return false
    width = w
    height = h
    dpr = nextDpr
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    return true
  }

  function rebuild(): void {
    if (!fit()) return
    grid = buildGrid(width, height, seed, grid)
    // Animated mode redraws on the next frame; static mode must redraw now
    // because resizing the backing store cleared it.
    if (reduced && grid) drawGrid(ctx!, grid, dpr, performance.now(), energy)
  }

  rebuild()

  // Debounced resize → rebuild grid
  let resizeTimer: number | undefined
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(rebuild, RESIZE_DEBOUNCE_MS)
      })
    : null
  observer?.observe(canvas)

  if (reduced) {
    // Static grid: drawn once by rebuild(); no pointer tracking, no RAF.
    ready.value = true
    return () => {
      window.clearTimeout(resizeTimer)
      observer?.disconnect()
    }
  }

  // ─── Pointer state (canvas CSS-pixel space) ──────────────────────────────
  let hasPointer = false
  let pointerX = 0
  let pointerY = 0
  let clientX = 0
  let clientY = 0
  let pointerStale = false // re-project client → canvas coords after a scroll
  let lastMove = 0

  function projectPointer(): void {
    const rect = canvas.getBoundingClientRect()
    pointerX = clientX - rect.left
    pointerY = clientY - rect.top
  }

  function onMouseMove(ev: MouseEvent): void {
    clientX = ev.clientX
    clientY = ev.clientY
    hasPointer = true
    pointerStale = false
    projectPointer()
    lastMove = performance.now()
  }

  // The canvas is pointer-events:none, so listen on window and clear the
  // hover point only when the pointer actually leaves the window.
  function onMouseOut(ev: MouseEvent): void {
    if (ev.relatedTarget === null) hasPointer = false
  }

  function onScroll(): void {
    if (hasPointer) pointerStale = true
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseout', onMouseOut, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })

  // ─── Animation loop ──────────────────────────────────────────────────────
  let raf = 0
  let last = performance.now()
  let nextSpark = FIRST_SPARK_MS
  let firstFrame = true

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    if (!grid) return
    const cells = grid.cells
    const dt = Math.min(MAX_DT, (now - last) / 1000)
    last = now

    // continuous decay
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]!
      if (cell.e > 0) cell.e = Math.max(0, cell.e - dt * DECAY_PER_SECOND)
    }

    // hover excites the nearest cells
    if (hasPointer) {
      if (pointerStale) {
        pointerStale = false
        projectPointer()
      }
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!
        const dx = cell.x - pointerX
        const dy = cell.y - pointerY
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < HOVER_RADIUS) cell.e = Math.max(cell.e, 1 - d / HOVER_FALLOFF)
      }
    }

    // idle sparks wander the hive when nobody is hovering
    nextSpark -= dt * 1000
    if (nextSpark <= 0) {
      if (!hasPointer || now - lastMove > IDLE_AFTER_MS) {
        const k = Math.floor(Math.random() * cells.length)
        cells[k]!.e = 1
      }
      nextSpark = SPARK_MIN_MS + Math.random() * SPARK_RANGE_MS
    }

    // signal propagation, eased every frame (see propagate)
    propagate(grid, dt)

    drawGrid(ctx!, grid, dpr, now, energy)

    if (firstFrame) {
      firstFrame = false
      ready.value = true
    }
  }

  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    window.clearTimeout(resizeTimer)
    observer?.disconnect()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseout', onMouseOut)
    window.removeEventListener('scroll', onScroll, { capture: true })
  }
}

onMounted(() => {
  if (canvasRef.value) dispose = startHive(canvasRef.value)
})

onBeforeUnmount(() => {
  dispose?.()
  dispose = null
})
</script>

<template>
  <div
    class="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
    aria-hidden="true"
  >
    <!-- Reactive honeycomb canvas layer -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full hive-canvas"
      :class="{ 'is-ready': ready }"
      aria-hidden="true"
    />

    <!-- Depth gradient overlays -->
    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-(--ui-bg)" />
    <div class="absolute inset-0 bg-gradient-to-r from-(--ui-bg) via-transparent to-(--ui-bg) opacity-60" />
    <div class="absolute inset-0 bg-gradient-to-t from-(--ui-bg) via-transparent to-(--ui-bg) opacity-40" />

    <!-- Central energy glow -->
    <div
      class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[160px] opacity-20 hex-energy"
      style="width: 600px; height: 400px; background: var(--color-green-500);"
    />
  </div>
</template>

<style scoped>
.hive-canvas {
  display: block;
  opacity: 0;
  transition: opacity 0.6s ease-out;
}

.hive-canvas.is-ready {
  opacity: 1;
}

.hex-energy {
  animation: hex-energy-pulse 6s ease-in-out infinite;
}

@keyframes hex-energy-pulse {
  0%, 100% { opacity: 0.12; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.15); }
}
</style>
