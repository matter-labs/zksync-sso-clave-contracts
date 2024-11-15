<template>
  <component
    :is="as"
    class="line-container"
    :class="`variant-${variant}`"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
defineProps({
  as: {
    type: [String, Object] as PropType<string | Component>,
    default: "div",
  },
  variant: {
    type: String as PropType<"bordered" | "headless">,
    default: "bordered",
  },
});
</script>

<style lang="scss" scoped>
.line-container {
  @apply w-full;
  &.variant-bordered {
    @apply rounded-[28px] bg-neutral-950 border border-neutral-800;
  }
}
</style>
