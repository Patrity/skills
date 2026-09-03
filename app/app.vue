<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · Skills` : 'Skills — reusable Claude Code setups'),
  htmlAttrs: { lang: 'en' }
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
