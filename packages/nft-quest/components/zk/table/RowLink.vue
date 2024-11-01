<template>
  <a
    href="#"
    :class="linkUI"
  >
    <ZkTableRow :ui="rowUI">
      <div :class="slotUI">
        <slot />
      </div>
      <ZkTableCellData class="text-right">
        <zk-button-icon
          icon="open_in_new"
          class="dark:text-neutral-400"
        />
      </ZkTableCellData>
    </ZkTableRow>
  </a>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

const props = defineProps<{
  ui?: {
    link?: string;
    row?: string;
    slot?: string;
  };
}>();

const linkUI = twMerge(
  "inline-block p-3 border-b border-neutral-200 first:rounded-t-zk last:rounded-b-zk last:border-b-0 w-full hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-950 dark:text-neutral-100",
  props.ui?.link,
);

const rowUI = twMerge("p-0 border-none", props.ui?.row);
const slotUI = twMerge(
  "flex-auto align-middle flex flex-col justify-center items-start",
  props.ui?.slot,
);
</script>
