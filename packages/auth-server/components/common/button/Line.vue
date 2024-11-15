<template>
  <CommonLine
    :is="as"
    class="line-button-container"
    :class="[`size-${size}`]"
  >
    <slot />
  </CommonLine>
</template>

<script lang="ts" setup>
defineProps({
  as: {
    type: [String, Object] as PropType<string | Component>,
    default: "button",
  },
  size: {
    type: String as PropType<"md" | "sm">,
    default: "md",
  },
});
</script>

<style lang="scss" scoped>
.line-button-container {
  @apply transition-colors;
  &:enabled,
  &:is(a) {
    &:not([aria-disabled="true"]) {
      @apply cursor-pointer hover:bg-neutral-800;
    }
  }
  &:disabled,
  &[aria-disabled="true"] {
    @apply cursor-not-allowed opacity-75;
  }

  &.size- {
    &md {
      @apply py-3 px-4;
    }
    &sm {
      @apply py-2 px-3;
    }
  }
}
</style>
