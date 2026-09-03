<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <UApp>
    <div class="min-h-svh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="text-6xl font-semibold text-highlighted">
        {{ error.statusCode }}
      </p>
      <p class="text-muted">
        {{ error.statusCode === 404 ? 'That page does not exist.' : (error.statusMessage || 'Something went wrong.') }}
      </p>
      <UButton
        label="Back home"
        icon="i-lucide-house"
        color="neutral"
        variant="subtle"
        @click="clearError({ redirect: '/' })"
      />
    </div>
  </UApp>
</template>
