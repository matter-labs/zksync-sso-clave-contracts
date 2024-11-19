<template>
  <div :class="bodyUI">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

const props = defineProps<{
  ui?: string;
}>();

const bodyUI = computed(() => {
  return twMerge(
    "border border-neutral-200 rounded-zk bg-white dark:bg-neutral-900 dark:border-neutral-700",
    props.ui,
  );
});
</script>
