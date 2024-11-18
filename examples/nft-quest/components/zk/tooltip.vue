<template>
  <ClientOnly>
    <Tooltip.Provider
      :delay-duration="150"
      disable-closing-trigger
    >
      <Tooltip.Root>
        <Tooltip.Trigger as-child>
          <slot />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            class="data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade select-none rounded-[6px] bg-white px-2 py-1 text-[15px] leading-none will-change-[transform,opacity] dark:text-neutral-100 dark:bg-neutral-800"
            :side-offset="5"
          >
            {{ label }}
            <Tooltip.Arrow
              class="fill-white dark:fill-neutral-800"
              :width="8"
            />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  </ClientOnly>
</template>

<script setup lang="ts">
import { Tooltip } from "radix-vue/namespaced";

defineProps({
  label: {
    type: String,
    required: true,
  },
});
</script>
