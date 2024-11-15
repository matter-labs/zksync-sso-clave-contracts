<template>
  <ClientOnly>
    <DropdownMenu.Root v-model:open="toggleState">
      <DropdownMenu.Trigger>
        <slot>
          <ZkButton>
            <ZkIcon icon="settings" />
            <template #postfix>
              <ZkIcon
                :icon="
                  toggleState ? 'keyboard_arrow_up' : 'keyboard_arrow_down'
                "
              />
            </template>
          </ZkButton>
        </slot>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          class="min-w-[180px] max-w-[320px] bg-white rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] outline-none will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade border border-neutral-200"
        >
          <DropdownMenu.Item
            v-for="(item, index) in menu"
            :key="index"
            class="group relative flex items-center py-3 px-2 text-sm leading-none rounded-[3px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950 text-neutral-700 cursor-pointer"
            @click="selectItem(item.value)"
          >
            {{ item.label }}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </ClientOnly>
</template>

<script setup lang="ts">
import { DropdownMenu } from "radix-vue/namespaced";

const toggleState = ref(false);
// const dropdownState = defineModel("toggleState", { type: Boolean });
const emit = defineEmits(["select", "update:toggleState"]);

type MenuItem = {
  value: string;
  label: string;
  icon?: string;
};
type MenuItems = Array<MenuItem>;

defineProps<{ menu: MenuItems }>();

function selectItem(value: string) {
  emit("select", value);
  toggleState.value = false;
}

watch(toggleState, (newValue) => {
  emit("update:toggleState", newValue);
});
</script>
