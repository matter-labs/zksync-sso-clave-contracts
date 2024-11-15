<template>
  <ClientOnly>
    <DropdownMenu.Root
      v-if="isConnected"
      v-model:open="toggleState"
    >
      <DropdownMenu.Trigger>
        <div class="flex items-center border-l border-neutral-900 h-full px-4 text-neutral-400">
          {{ shortAddress || "" }}
          <ZkIcon icon="keyboard_arrow_down" />
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          class="min-w-[180px] max-w-[320px] bg-white rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] outline-none will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade border border-neutral-200"
        >
          <DropdownMenu.Item

            class="group relative flex items-center py-3 px-2 text-sm leading-none rounded-[3px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950 text-neutral-700 cursor-pointer"
            @click="disconnect"
          >
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </ClientOnly>
</template>

<script setup lang="ts">
import { DropdownMenu } from "radix-vue/namespaced";

const { shortAddress, isConnected } = storeToRefs(useConnectorStore());
const { disconnectAccount } = useConnectorStore();

const toggleState = ref(false);
const emit = defineEmits(["select", "update:toggleState"]);

function disconnect() {
  disconnectAccount();
  toggleState.value = false;
  navigateTo("/");
}

watch(toggleState, (newValue) => {
  emit("update:toggleState", newValue);
});
</script>
