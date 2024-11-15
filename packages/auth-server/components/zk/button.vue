<template>
  <button
    :class="buttonUI"
    :type="submit ? 'submit' : 'button'"
  >
    <div
      v-if="$slots.prefix"
      :class="twMerge('button-fix -ml-1 mr-0.5', ui?.prefix)"
    >
      <slot name="prefix" />
    </div>
    <span :class="twMerge('inline-block py-3', ui?.base)"><slot /></span>
    <div
      v-if="$slots.postfix"
      :class="twMerge('button-fix ml-1 -mr-2', ui?.postfix)"
    >
      <slot name="postfix" />
    </div>
    <div
      v-show="loading"
      class="absolute flex justify-center items-center bg-white/90 top-0 left-0 w-full h-full rounded-full"
    >
      <CommonSpinner
        :height="24"
        class="dark:text-neutral-800"
      />
    </div>
  </button>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

export type ButtonTypes =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "tertiary";
export type ButtonUI = {
  button?: string;
  base?: string;
  prefix?: string;
  postfix?: string;
};

const { ui, type = "primary", loading = false } = defineProps<{
  type?: ButtonTypes;
  ui?: ButtonUI;
  loading?: boolean;
  submit?: boolean;
}>();

const buttonUI = computed(() => {
  let base
    = "relative inline-flex items-center justify-center rounded-zk border border-transparent px-4 py-1 align-middle leading-3 focus:outline-none focus:ring-4 focus:ring-primary-400 focus:ring-opacity-50 dark:focus:ring-blue-800 dark:focus:ring-opacity-80 disabled:cursor-not-allowed";

  if (type) {
    base = twMerge(base, types[type]);
  }
  return twMerge(base, types[type], ui?.button);
});
const types = {
  primary:
    "bg-neutral-950 text-neutral-100 hover:bg-neutral-800 hover:text-white focus:bg-neutral-800 active:bg-neutral-950 active:text-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:hover:text-neutral-950 dark:focus:bg-neutral-100 dark:focus:text-neutral-950 dark:active:bg-neutral-300 dark:disabled:hover:bg-neutral-700 dark:disabled:hover:text-neutral-400",
  secondary:
    "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 hover:text-neutral-800 focus:bg-neutral-300 active:bg-neutral-400 active:text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus:bg-neutral-800 dark:active:bg-neutral-900 dark:active:text-neutral-400 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-500",
  danger:
    "bg-error-100 text-error-950 focus:bg-error-200 hover:bg-error-200  active:bg-error-300 disabled:bg-transparent dark:bg-error-400/20 dark:text-error-300 dark:hover:bg-error-400/40 dark:active:bg-error-400/20 disabled:bg-error-100/70 disabled:text-error-800/70 disabled:dark:hover:bg-error-100/70",
  ghost:
    "border-neutral-100 bg-inherit text-neutral-800 focus:bg-neutral-100 hover:bg-neutral-100 active:bg-neutral-300 active:text-neutral-950/70 disabled:bg-neutral-100 disabled:text-neutral-600 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus:bg-neutral-800 dark:active:bg-neutral-900 dark:active:text-neutral-300 disabled:dark:bg-neutral-100 disabled:dark:text-neutral-600",
  tertiary:
    "border-neutral-200 bg-neutral-100/50 text-neutral-800 focus:bg-neutral-100 hover:bg-neutral-100 hover:text-neutral-900 active:text-neutral-950/50 disabled:bg-neutral-100 disabled:text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 dark:focus:text-neutral-100 dark:active:bg-neutral-900 disabled:dark:hover:bg-neutral-100 disabled:dark:hover:text-neutral-600",
};
</script>

<style>
.button-fix .zk-icon {
  @apply -ml-0.5 mr-0.5 inline-block text-inherit;
}
</style>
