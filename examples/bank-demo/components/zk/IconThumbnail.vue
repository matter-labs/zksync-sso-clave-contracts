<template>
  <div
    class="bg-neutral-200 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-800 w-[2.75rem] h-[2.75rem] p-2 rounded-full text-center"
  >
    <ZkIcon :icon :ui="'!text-2xl'"/>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
}>();
</script>
