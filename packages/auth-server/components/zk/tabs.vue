<script setup lang="ts">
import { Tabs } from "radix-vue/namespaced";

interface Tab {
  slot: string;
  icon: string;
  label: string;
}

defineProps<{
  tabs: Tab[];
}>();
</script>

<template>
  <Tabs.Root
    class="flex flex-col w-full"
    :default-value="tabs[0].slot"
  >
    <Tabs.List
      class="relative shrink-0 flex border-b border-neutral-200 dark:border-neutral-700"
    >
      <Tabs.Indicator
        class="absolute left-0 h-[2px] bottom-0 w-[--radix-tabs-indicator-size] translate-x-[--radix-tabs-indicator-position] rounded-full transition-[width,transform] duration-300"
      >
        <div class="bg-neutral-950 w-full h-full dark:bg-neutral-100" />
      </Tabs.Indicator>
      <Tabs.Trigger
        v-for="(tab, index) of tabs"
        :key="index"
        :value="tab.slot"
        class="bg-transparent px-5 h-[45px] flex items-center justify-center text-[15px] leading-none data-[state=active]:font-semibold data-[state=active]:text-neutral-950 text-neutral-700 outline-none cursor-pointer hover:text-neutral-950 border-b border-transparent hover:border-neutral-400 focus-visible:ring-2 focus-visible:text-neutral-950 dark:text-neutral-300 dark:data-[state=active]:text-neutral-100 dark:hover:text-neutral-200 dark:hover:border-neutral-300"
      >
        <zk-icon
          :icon="tab.icon"
          class="mr-1"
        />
        {{ tab.label }}
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content
      v-for="(tab, index) of tabs"
      :key="index"
      :value="tab.slot"
      class="grow p-5 bg-transparent rounded-b-md outline-none dark:text-white"
    >
      <slot :name="tab.slot" />
    </Tabs.Content>
  </Tabs.Root>
</template>
