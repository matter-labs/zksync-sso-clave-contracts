<template>
  <div class="flex items-center">
    <div class="flex-auto">
      <h2 class="text-2xl text-bold dark:text-neutral-100">{{ title }}</h2>
      <p class="text-sm text-neutral-700 dark:text-neutral-400">{{ sub }}</p>
    </div>
    <div>
      <slot name="aside"/>
    </div>
  </div>
  <div class="mt-4 mb-6 dark:text-neutral-100">
    <slot/>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  sub?: string;
}>();
</script>
