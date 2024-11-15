<template>
  <div :class="headerUI">
    <h3 :class="titleUI">
      {{ title }}
    </h3>
    <slot name="header-side" />
  </div>
  <div :class="bodyUI">
    <slot />
  </div>
  <div
    v-if="$slots.footer"
    :class="footerUI"
  >
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

const slots = useSlots();

const props = defineProps<{
  title: string;
  ui?: {
    header?: string;
    title?: string;
    body?: string;
    footer?: string;
  };
}>();

const headerUI = twMerge(
  "px-4 flex items-center bg-neutral-100 rounded-t-zk py-2 dark:bg-neutral-950",
  props.ui?.header,
);

const titleUI = twMerge(
  "text-lg text-neutral-900 flex-auto dark:text-neutral-100",
  props.ui?.title,
);

const bodyUI = computed(() => {
  let baseUI = "bg-neutral-100 rounded-zk rounded-t-none dark:bg-neutral-950";
  if (slots.footer) {
    baseUI = twMerge(baseUI, "rounded-b-none");
  }

  return twMerge(baseUI, props.ui?.body);
});

const footerUI = twMerge(
  "bg-neutral-100 rounded-b-zk p-2 px-4 dark:bg-neutral-950",
  props.ui?.footer,
);
</script>
