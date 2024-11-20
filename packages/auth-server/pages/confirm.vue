<template>
  <div class="h-[100dvh]">
    <ViewsLoading
      v-if="!hasRequests && !appMeta"
      key="loading"
    />
    <NuxtPage v-else />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "popup",
});

const { appMeta } = useAppMeta();
const { hasRequests } = storeToRefs(useRequestsStore());

const { init } = useCommunicatorStore();

init();

definePageMeta({
  layout: "popup",
});
</script>
