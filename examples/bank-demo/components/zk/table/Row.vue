<template>
  <div :class="rowUI">
    <slot/>
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

const props = defineProps<{
  ui?: string;
}>();

const rowUI = computed(() => {
  return twMerge(
    "p-3 border-b border-neutral-200 first:rounded-t-zk last:rounded-b-zk last:border-b-0 flex gap-2 dark:border-neutral-700 dark:text-neutral-100 hover:bg-neutral-100/25 dark:hover:bg-neutral-800/25",
    props.ui
  );
});
</script>
