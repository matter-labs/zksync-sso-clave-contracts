<template>
  <client-only>
    <Dialog.Root>
      <Dialog.Trigger>
        <ZkButton>Dialog</ZkButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          class="data-[state=open]:animate-overlayShow fixed inset-0 z-30 bg-neutral-900/70"
        />
        <Dialog.Content
          class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[350px] translate-x-[-50%] translate-y-[-50%] rounded-zk bg-white focus:outline-none z-[100] p-4 dark:bg-neutral-950 border border-transparent dark:border-neutral-800 dark:text-neutral-100"
        >
          <Dialog.Title class="text-lg flex items-center mb-8">
            <span class="flex-auto">{{ title }}</span>
            <Dialog.Close
              class="inline-flex appearance-none items-center justify-center focus:outline-none focus:ring-1 rounded-full"
              aria-label="Close"
            >
              <ZkIcon icon="close" />
            </Dialog.Close>
          </Dialog.Title>
          <Dialog.Description class="mb-10 text-lg text-center">
            <slot />
          </Dialog.Description>

          <div class="flex flex-col gap-2 justify-end">
            <Dialog.Close as-child>
              <slot name="submit">
                <ZkButton
                  type="primary"
                  class="w-full"
                >
                  Confirm
                </ZkButton>
              </slot>
            </Dialog.Close>
            <Dialog.Close as-child>
              <ZkButton
                type="secondary"
                class="w-full"
              >
                Cancel
              </ZkButton>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </client-only>
</template>

<script setup lang="ts">
import { Dialog } from "radix-vue/namespaced";

defineProps<{
  title: string;
}>();
</script>
