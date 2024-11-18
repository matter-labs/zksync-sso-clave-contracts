<template>
  <ZkButton
    :type
    :ui="buttonUI"
  >
    <ZkIcon
      :ui="iconUI"
      :icon
    />
  </ZkButton>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

import type { ButtonTypes, ButtonUI } from "./button.vue";

const {
  type = "ghost",
  icon,
  // eslint-disable-next-line vue/require-valid-default-prop
  ui = { button: {}, icon: "" },
} = defineProps<{
  type?: ButtonTypes;
  icon: string;
  ui?: {
    button?: ButtonUI;
    icon?: string;
  };
}>();

const buttonTypes: Record<ButtonTypes, string> = {
  primary: "text-neutral-200 hover:text-neutral-100",
  secondary: "bg-neutral-200 disabled:bg-transparent disabled:text-neutral-400",
  ghost:
    "bg-transparent disabled:bg-transparent disabled:text-neutral-400 border-transparent dark:border-none disabled:dark:bg-transparent disabled:hover:bg-transparent disabled:hover:text-neutral-400 disabled:dark:hover:bg-transparent",
  danger: "text-error-950 hover:text-error-900",
  tertiary: "",
};

const iconTypes: Record<ButtonTypes, string> = {
  primary: "text-inherit",
  secondary: "",
  ghost: "",
  danger: "",
  tertiary: "",
};

const buttonUI = {
  button: twMerge(
    "w-[40px] h-[40px] p-0 leading-3 align-middle text-neutral-700",
    buttonTypes[type],
    ui.button?.button,
  ),
  base: twMerge(ui.button?.base),
  prefix: twMerge(ui.button?.prefix),
  postfix: twMerge(ui.button?.postfix),
};

const iconUI = twMerge(iconTypes[type], ui.icon);
</script>
