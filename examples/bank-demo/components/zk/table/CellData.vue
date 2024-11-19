<template>
  <div :class="cellUI">
    <div class="text-neutral-950 dark:text-inherit">
      <slot/>
    </div>
    <div class="text-neutral-700 dark:text-neutral-400">
      <slot name="sub"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

const props = defineProps<{
  ui?: string;
}>();

const cellUI = computed(() => {
  return twMerge("flex flex-col justify-center", props.ui);
});
</script>
