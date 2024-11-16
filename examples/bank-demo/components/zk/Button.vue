<template>
  <button type="button" :class="buttonUI">
    <div
      v-if="$slots.prefix"
      :class="twMerge('button-fix -ml-1 mr-0.5', ui?.prefix)"
    >
      <slot name="prefix"/>
    </div>
    <span :class="twMerge('inline-block py-3', ui?.base)"><slot/></span>
    <div
      v-if="$slots.postfix"
      :class="twMerge('button-fix ml-1 -mr-2', ui?.postfix)"
    >
      <slot name="postfix"/>
    </div>
  </button>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

export type ButtonTypes =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";
export type ButtonUI = {
  button?: string;
  base?: string;
  prefix?: string;
  postfix?: string;
};

const { ui, type = "primary" } = defineProps<{
  type?: ButtonTypes;
  ui?: ButtonUI;
}>();

const buttonUI = computed(() => {
  let base =
    "inline-flex items-center justify-center rounded-full border border-transparent px-4 py-1 align-middle leading-3 focus:outline-none focus:ring-4 focus:ring-primary-400 focus:ring-opacity-50 dark:focus:ring-primary-800 dark:focus:ring-opacity-80 disabled:cursor-not-allowed";

  if (type) {
    base = twMerge(base, types[type]);
  }
  return twMerge(base, types[type], ui?.button);
});
const types = {
  primary: "bg-primary-500 text-white disabled:bg-primary-400 hover:bg-primary-600/80 focus:bg-primary-600 active:bg-primary-700",
  secondary:
    "bg-primary-400/30 text-primary-700 hover:bg-primary-400/80 disabled:bg-primary-300 disabled:text-primary-200",
  danger:
    "bg-error-100 text-error-800 hover:bg-error-200 disabled:bg-error-100/50 disabled:text-error-800/50",
  ghost:
    "border-transparent bg-inherit hover:bg-primary-100/50 text-primary-600 disabled:bg-inherit disabled:text-primary-600/50",
};
</script>

<style>
.button-fix .ZkIcon {
  @apply -ml-0.5 mr-0.5 inline-block text-inherit;
}
</style>
