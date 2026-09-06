<script setup lang="ts">
import { NAV } from '~~/shared/utils/links'

/**
 * Sticky top bar. Transparent over the hero, frosted once the page has scrolled; the
 * threshold is a plain scroll listener rather than a VueUse import so the shell adds no
 * dependency.
 */
const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const route = useRoute()
/** `/docs/start-here` marks Docs current, not just an exact `/docs`. */
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-default transition-colors duration-200"
    :class="scrolled ? 'bg-(--ui-bg)/72 backdrop-blur-xl' : 'bg-transparent'"
  >
    <div class="mx-auto flex h-14 md:h-16 max-w-7xl items-center gap-3 md:gap-6 px-4 sm:px-6">
      <BrandWordmark
        byline
        :size="30"
      />

      <!-- Always in the DOM (hidden below md) so the drawer is the only mobile nav. -->
      <nav
        class="hidden md:flex items-center gap-7 mx-auto"
        aria-label="Main"
      >
        <template
          v-for="item in NAV"
          :key="item.label"
        >
          <a
            v-if="item.external"
            :href="item.to"
            class="inline-flex items-center gap-1.5 text-[0.9375rem] text-muted hover:text-primary transition-colors"
          >
            {{ item.label }}
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-3.5"
            />
          </a>
          <NuxtLink
            v-else
            :to="item.to"
            :aria-current="isCurrent(item.to) ? 'page' : undefined"
            class="text-[0.9375rem] transition-colors"
            :class="isCurrent(item.to) ? 'text-primary font-semibold' : 'text-muted hover:text-primary'"
          >
            {{ item.label }}
          </NuxtLink>
        </template>
      </nav>

      <div class="flex items-center gap-0.5 ms-auto md:ms-0">
        <UColorModeButton />
        <SocialLinks
          :only="['GitHub', 'X']"
          class="hidden md:flex"
        />
        <SiteNavDrawer class="md:hidden" />
      </div>
    </div>
  </header>
</template>
