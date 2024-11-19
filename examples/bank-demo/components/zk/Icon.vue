<template>
  <span
    :class="
      twMerge('ZkIcon material-symbols-outlined fill-current text-inherit', ui)
    "
  >
    {{ icon }}
  </span>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200",
    },
  ],
});

defineProps<{
  icon: string;
  ui?: string;
}>();
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
}
</style>
