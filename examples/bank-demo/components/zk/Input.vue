<template>
  <div class="relative flex flex-col max-w-[380px]">
    <div class="flex">
      <input
        :placeholder
        type="text"
        :class="twMerge(inputUI, ui.input, stateUI)"
        :disabled
      >
      <div v-if="postLabel" :class="twMerge(postLabelUI, ui.postLabel)">
        {{ postLabel }}
      </div>
    </div>
    <div class="block pl-5">
      <span
        v-for="(message, index) in messages"
        :key="index"
        :class="
          twMerge('block text-xs text-red-600 dark:text-red-400', ui.messages)
        "
      >
        {{ message }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

type UI = {
  input?: string;
  postLabel?: string;
  messages?: string;
};

const {
  placeholder = "",
  postLabel,
  // eslint-disable-next-line vue/require-valid-default-prop
  ui = {},
  state,
  messages,
  disabled = false,
} = defineProps<{
  placeholder?: string;
  postLabel?: string;
  ui?: UI;
  state?: string;
  messages?: string[];
  disabled?: boolean;
}>();

const baseInputUI =
  "px-4 py-3 rounded-zk border border-neutral-300 inline-block";

const inputUI = computed(() => {
  let baseClasses = twMerge(
    baseInputUI,
    "focus:ring-primary-400 focus:outline-none focus:border-neutral-700 z-10 relative flex-auto disabled:border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:disabled:border-neutral-800 dark:text-neutral-100"
  );

  if (postLabel) {
    baseClasses = twMerge(baseClasses, "rounded-r-none z-10");
  }

  return baseClasses;
});

const postLabelUI = twMerge(
  baseInputUI,
  "text-neutral-600 bg-neutral-100 rounded-l-none rounded-r-zk border-l-none z-0 relative dark:bg-neutral-950 dark:border-neutral-700 dark:text-neutral-400"
);

const stateUI = computed(() => {
  if (state === "error") {
    return "border-red-400 focus:border-red-400 dark:border-red-400 dark:focus:border-red-400/80";
  }

  return "";
});
</script>
