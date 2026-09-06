<script setup lang="ts">
import { LINKS } from '~~/shared/utils/links'

interface FooterLink {
  label: string
  /** Dimmed suffix on the same line (the handle, the feed name). */
  note?: string
  href: string
  icon?: string
  /** Personal profile: carries the `rel="me"` identity claim (spec §6). */
  me?: boolean
  /** Socials and tooling open in a new tab; the blog stays in this one. */
  newTab?: boolean
}

const elsewhere: FooterLink[] = [
  { label: 'Blog', note: '· Lab Notes', href: LINKS.blog },
  { label: 'X', note: '@Patrity', href: LINKS.x, icon: 'i-simple-icons-x', me: true, newTab: true },
  { label: 'GitHub', note: 'Patrity', href: LINKS.github, icon: 'i-simple-icons-github', me: true, newTab: true },
  { label: 'Bluesky', href: LINKS.bluesky, icon: 'i-simple-icons-bluesky', me: true, newTab: true },
  { label: 'LinkedIn', href: LINKS.linkedin, icon: 'i-simple-icons-linkedin', me: true, newTab: true },
  { label: 'Blog RSS', href: LINKS.rss, icon: 'i-lucide-rss', newTab: true }
]

const registry: FooterLink[] = [
  { label: '@patrity/skills', href: LINKS.npm, icon: 'i-simple-icons-npm', newTab: true },
  { label: 'MIT', href: `${LINKS.repo}/blob/main/LICENSE`, newTab: true },
  { label: 'Source on GitHub', href: LINKS.repo, icon: 'i-simple-icons-github', newTab: true }
]

const rel = (link: FooterLink) => (link.me ? 'me noopener' : link.newTab ? 'noopener' : undefined)

const year = new Date().getFullYear()

// The `~/` line names where you are; derived from the site URL so a preview never
// claims the production host.
const { public: { siteUrl } } = useRuntimeConfig()
const host = computed(() => {
  try {
    return new URL(siteUrl).host
  } catch {
    return 'skills.patrity.com'
  }
})
</script>

<template>
  <footer class="relative overflow-hidden border-t border-default">
    <div
      class="hive-texture absolute inset-0"
      aria-hidden="true"
    />

    <div class="relative mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-7 md:gap-10 px-4 sm:px-6 pt-7 md:pt-10 pb-5 md:pb-7">
      <div>
        <BrandWordmark byline />
        <p class="mt-3 max-w-96 text-sm/relaxed text-muted">
          One Claude Code setup, cut into bundles so you can take the parts you agree with and leave the rest.
        </p>
      </div>

      <div>
        <MicroLabel class="block mb-3">
          Elsewhere
        </MicroLabel>
        <ul>
          <li
            v-for="link in elsewhere"
            :key="link.label"
          >
            <a
              :href="link.href"
              :target="link.newTab ? '_blank' : undefined"
              :rel="rel(link)"
              class="flex items-center gap-2 py-0.5 text-sm text-muted hover:text-primary transition-colors"
            >
              <UIcon
                v-if="link.icon"
                :name="link.icon"
                class="size-3.5 shrink-0"
              />
              {{ link.label }}
              <span
                v-if="link.note"
                class="text-dimmed"
              >{{ link.note }}</span>
            </a>
          </li>
        </ul>
      </div>

      <div>
        <MicroLabel class="block mb-3">
          Registry
        </MicroLabel>
        <ul>
          <li
            v-for="link in registry"
            :key="link.label"
          >
            <a
              :href="link.href"
              :target="link.newTab ? '_blank' : undefined"
              :rel="rel(link)"
              class="flex items-center gap-2 py-0.5 text-sm text-muted hover:text-primary transition-colors"
            >
              <UIcon
                v-if="link.icon"
                :name="link.icon"
                class="size-3.5 shrink-0"
              />
              {{ link.label }}
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="relative mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-4 sm:px-6 py-3.5 border-t border-default font-mono text-xs text-dimmed">
      <span><span class="text-primary">~/</span> {{ host }}</span>
      <span>© {{ year }} Tony Costanzo</span>
    </div>
  </footer>
</template>
