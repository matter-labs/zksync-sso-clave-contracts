<template>
  <client-only>
    <Dialog.Root v-model:open="open">
      <Dialog.Trigger>
        <zk-button-icon icon="menu" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          class="data-[state=open]:animate-overlayShow fixed inset-0 z-30 bg-neutral-950/50"
        />
        <Dialog.Content
          class="data-[state=open]:animate-slideDownAndFade fixed top-0 left-4 right-4 rounded-zk bg-white focus:outline-none z-[100] p-4 dark:bg-neutral-900 border border-transparent dark:border-neutral-800 dark:text-neutral-100 mt-4"
        >
          <Dialog.Title class="text-lg flex items-center mb-8">
            <span class="flex-auto">Menu</span>
            <app-color-mode />
            <Dialog.Close
              class="ml-2 p-2 inline-flex appearance-none items-center justify-center focus:outline-none focus:ring-1 rounded-full"
              aria-label="Close"
            >
              <zk-icon icon="close" />
            </Dialog.Close>
          </Dialog.Title>
          <Dialog.Description class="mb-10 text-lg text-center">
            <slot />
          </Dialog.Description>

          <div class="flex flex-col gap-2 justify-end">
            <ZkLink
              v-for="link in mainNav"
              :key="link.href"
              :href="link.href"
              class="w-full"
              type="secondary"
              ui="justify-start dark:border-neutral-800 border-neutral-300"
              @click="open = false"
            >
              <zk-icon
                :icon="link.icon"
                class="mr-1 -ml-1"
              /> {{ link.name }}
            </ZkLink>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </client-only>
</template>

<script setup lang="ts">
import { Dialog } from "radix-vue/namespaced";

const { mainNav } = useNav();
const open = ref(false);
</script>

<style lang="postcss" scoped>
.router-link-exact-active {
  @apply bg-neutral-950 text-neutral-100 hover:bg-neutral-800 hover:text-white active:bg-neutral-950 active:text-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 dark:hover:text-neutral-950 dark:focus:bg-neutral-100 dark:focus:text-neutral-950 dark:active:bg-neutral-300 dark:disabled:hover:bg-neutral-700 dark:disabled:hover:text-neutral-400;
}
</style>
