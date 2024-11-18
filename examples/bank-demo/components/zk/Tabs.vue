<script setup lang="ts">
import { Tabs } from "radix-vue/namespaced";
interface Tab {
  slot: string;
  icon?: string;
  label: string;
}

defineProps<{
  tabs: Tab[];
}>();

const currentTabSlot = defineModel<string | number>();
</script>

<template>
  <Tabs.Root v-model="currentTabSlot" class="flex flex-col w-full">
    <Tabs.List
      class="relative w-full flex bg-neutral-200 rounded-full"
    >
      <Tabs.Indicator
        class="z-1 absolute left-1 top-1 bottom-1 w-[--radix-tabs-indicator-size] translate-x-[--radix-tabs-indicator-position] rounded-full transition-[width,transform] duration-300"
      >
        <div class="bg-white rounded-full w-[96.5%] h-full" />
      </Tabs.Indicator>
      <Tabs.Trigger
        v-for="(tab, index) of tabs"
        :key="index"
        :value="tab.slot"
        class="grow relative z-2 bg-transparent px-5 h-[2.8rem] flex items-center justify-center text-[1rem] leading-none data-[state=active]:font-semibold data-[state=active]:text-neutral-950 text-neutral-500 outline-none cursor-pointer hover:text-neutral-950 border-b border-transparent focus-visible:ring-2 focus-visible:text-neutral-950 dark:text-neutral-300 dark:data-[state=active]:text-neutral-100 dark:hover:text-neutral-200 dark:hover:border-neutral-300"
      >
        <ZkIcon v-if="tab.icon" :icon="tab.icon" class="mr-1" />
        {{ tab.label }}
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content
      v-for="(tab, index) of tabs"
      :key="index"
      :value="tab.slot"
      class="grow pt-5 bg-transparent rounded-b-md outline-none dark:text-white"
    >
      <slot :name="tab.slot"/>
    </Tabs.Content>
  </Tabs.Root>
</template>
