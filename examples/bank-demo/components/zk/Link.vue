<template>
  <NuxtLink v-bind="$props" :class="linkUI">
    <slot/>
  </NuxtLink>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";
import type { NuxtLinkProps } from "nuxt/app";

const { ui, type = "inline" } = defineProps<
  NuxtLinkProps & {
    type?: "primary" | "secondary" | "ghost" | "tertiary" | "inline";
    ui?: string;
  }
>();

const linkUI = computed(() => {
  let base =
    "inline-block inline-flex items-center justify-center border border-transparent px-4 py-3 align-middle leading-3 focus:outline-none focus:ring-4 focus:ring-primary-400 focus:ring-opacity-50";

  if (type) {
    base = twMerge(base, types[type]);
  }
  return twMerge(base, types[type], ui);
});
const types = {
  primary:
    "rounded-full bg-primary-500 text-white hover:bg-primary-600/80 focus:bg-primary-600 active:bg-primary-700",
  secondary:
    "rounded-full bg-primary-400/30 text-primary-700 hover:bg-primary-400/80",
  danger:
    "rounded-full bg-error-100 text-error-800 hover:bg-error-200",
  ghost:
    "border-b-1 rounded-none border-x-0 border-t-0 border-b-primary-400/50 p-0 pb-0.5 pt-0.5 hover:border-b-blue-500 bg-inherit text-primary-600",
  inline:
    "border-b-1 rounded-none border-x-0 border-t-0 border-b-neutral-300 p-0 pb-0.5 hover:border-b-blue-400 hover:text-blue-800 dark:hover:text-blue-300 ",
  tertiary:
    "rounded-full border-neutral-200 bg-neutral-100/50 text-neutral-800 hover:bg-neutral-100 hover:text-neutral-900 active:text-neutral-950/50 disabled:bg-neutral-100 disabled:text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus:text-neutral-100 dark:active:bg-neutral-900",
};
</script>
