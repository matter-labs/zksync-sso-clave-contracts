<template>
  <label
    v-bind="containerAttrs"
    class="input-line-container"
  >
    <div
      v-if="$slots.icon"
      class="icon-container"
    >
      <slot name="icon" />
    </div>
    <input
      v-bind="inputAttrs"
      v-model="inputted"
      class="input-line"
    >
    <transition
      v-bind="TransitionOpacity"
      mode="out-in"
    >
      <CommonSpinner
        v-if="loading"
        class="-my-1.5 w-auto h-[2em]"
      />
    </transition>
  </label>
</template>

<script lang="ts" setup>
import { computed, useAttrs } from "vue";

defineOptions({
  inheritAttrs: false,
});
const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  (eventName: "update:modelValue", value: string): void;
}>();

const inputted = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const attrs = useAttrs();
const inputAttrsList = ["placeholder", "type", "name", "id", "disabled", "required", "autocomplete", "autofocus", "maxlength", "minlength", "spellcheck"];
const inputAttrs = computed(() => {
  return Object.keys(attrs).reduce((acc, key) => {
    if (inputAttrsList.includes(key)) {
      acc[key] = attrs[key];
    }
    return acc;
  }, {} as Record<string, unknown>);
});
const containerAttrs = computed(() => {
  return Object.keys(attrs).reduce((acc, key) => {
    if (!inputAttrsList.includes(key)) {
      acc[key] = attrs[key];
    }
    return acc;
  }, {} as Record<string, unknown>);
});
</script>

<style lang="scss" scoped>
.input-line-container {
  @apply flex gap-3 items-center w-full rounded-[32px] overflow-hidden bg-neutral-900 p-4 text-base ring-0 ring-primary-700 focus-within:ring-1 transition-all;

  .icon-container {
    @apply w-5 h-5 text-neutral-400 flex-shrink-0 ml-1 mr-0.5;

    svg {
      @apply w-full h-full flex-shrink-0;
    }
  }
  .input-line {
    @apply w-full bg-transparent border-none outline-none p-0 text-white placeholder:text-neutral-400;
  }
}
</style>
