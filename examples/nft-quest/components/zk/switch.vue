<template>
  <div class="flex gap-2 items-center">
    <label
      class="text-neutral-950 dark:text-neutral-100 select-none"
      :for="id"
    >
      <slot />
    </label>
    <Switch.Root
      :id
      v-model:checked="switchState"
      :disabled
      class="w-[52px] h-[30px] focus-within:outline focus-within:outline-blue-500 flex rounded-full relative data-[state=checked]:bg-success-700 bg-neutral-700 cursor-default data-[disabled]:bg-neutral-300 data-[state=checked]:data-[disabled]:bg-neutral-300 data-[disabled]:cursor-not-allowed border border-neutral-600 data-[state=checked]:border-green-800 data-[state=checked]:data-[disabled]:border-neutral-600 data-[disabled]:border-neutral-400"
    >
      <Switch.Thumb
        class="block w-[24px] h-[24px] my-auto bg-neutral-200 rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[24px] data-[state=checked]:bg-neutral-100 border data-[state=checked]:border-green-500 data-[disabled]:border-transparent data-[state=checked]:data-[disabled]:border-transparent"
      >
        <ZkIcon
          v-if="switchState"
          icon="check"
          :ui="`${
            disabled ? 'text-neutral-500' : 'text-green-900 '
          } -ml-[1px] -mt-[1px]`"
        />
        <ZkIcon
          v-else
          icon="close"
          :ui="`${
            disabled ? 'text-neutral-500' : 'text-neutral-900'
          } -ml-[1px] -mt-[1px]`"
        />
      </Switch.Thumb>
    </Switch.Root>
  </div>
</template>

<script setup lang="ts">
import { Switch } from "radix-vue/namespaced";
import { defineEmits, ref, watch } from "vue";

const { isChecked = false } = defineProps<{
  isChecked?: boolean;
  id: string;
  disabled?: boolean;
}>();
const switchState = ref(isChecked);

const emit = defineEmits<{
  (e: "onSwitch", value: boolean): void;
}>();

watch(switchState, (newValue) => {
  emit("onSwitch", newValue);
});
</script>
