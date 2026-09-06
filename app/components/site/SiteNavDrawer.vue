<script setup lang="ts">
import { NAV } from '~~/shared/utils/links'

/**
 * The `< md` menu: the hamburger *and* the slide-over it opens.
 *
 * The button is the slide-over's default slot, i.e. Reka UI's `DialogTrigger`, which is
 * what returns focus to the hamburger when the panel closes (Escape included). Rendering
 * the trigger separately and driving `open` by hand would lose that.
 */
const open = ref(false)

const route = useRoute()
/** `/docs/start-here` marks Docs, not just an exact `/docs`. */
const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Menu"
    side="right"
    :ui="{ content: 'max-w-xs' }"
  >
    <UButton
      icon="i-lucide-menu"
      color="neutral"
      variant="ghost"
      aria-label="Open menu"
    />

    <template #body>
      <nav aria-label="Site">
        <ul class="flex flex-col">
          <li
            v-for="item in NAV"
            :key="item.label"
          >
            <a
              v-if="item.external"
              :href="item.to"
              class="flex items-center gap-2 py-2 text-default hover:text-primary transition-colors"
              @click="open = false"
            >
              {{ item.label }}
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5 text-dimmed"
              />
            </a>
            <NuxtLink
              v-else
              :to="item.to"
              :aria-current="isCurrent(item.to) ? 'page' : undefined"
              class="flex items-center gap-2 py-2 text-default hover:text-primary transition-colors"
              :class="{ 'text-primary': isCurrent(item.to) }"
              @click="open = false"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="mt-2 pt-3 border-t border-default">
        <SocialLinks class="-ms-2" />
      </div>
    </template>
  </USlideover>
</template>
