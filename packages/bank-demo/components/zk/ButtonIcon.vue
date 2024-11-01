<template>
  <ZkButton :type :ui="buttonUI">
    <ZkIcon :ui="iconUI" :icon />
  </ZkButton>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";
import type { ButtonTypes, ButtonUI } from "./Button.vue";

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
  primary: "text-white",
  secondary: "text-primary-500",
  ghost:
    "text-primary-500 hover:text-primary-600",
  danger: "text-error-950 hover:text-error-900",
};

const iconTypes: Record<ButtonTypes, string> = {
  primary: "text-inherit",
  secondary: "text-inherit",
  ghost: "text-inherit",
  danger: "text-inherit",
};

const buttonUI = {
  button: twMerge(
    "w-[2.75rem] h-[2.75rem] p-0 leading-3 align-middle text-neutral-700",
    buttonTypes[type],
    ui.button?.button
  ),
  base: twMerge(ui.button?.base),
  prefix: twMerge(ui.button?.prefix),
  postfix: twMerge(ui.button?.postfix),
};

const iconUI = twMerge(iconTypes[type], ui.icon);
</script>
