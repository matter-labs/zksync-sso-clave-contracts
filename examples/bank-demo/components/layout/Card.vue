<template>
  <div
    :class="baseUI"
  >
    <slot/>
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";
const props = defineProps<{ui?: string}>();

const base = "border border-white rounded-zk bg-white p-8";

const baseUI = computed(() => {
  return twMerge(base, props.ui);
});
</script>
