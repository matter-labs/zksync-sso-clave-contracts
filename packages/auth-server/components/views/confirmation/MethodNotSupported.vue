<template>
  <div class="h-full flex flex-col">
    <h1 class="text-white text-center text-2xl mt-8 font-semibold">
      Method not supported
    </h1>
    <p class="text-neutral-400 text-center mt-2">
      {{ method }}
    </p>
    <div class="mt-auto flex flex-col gap-4">
      <CommonButton
        class="w-full"
        variant="neutral"
        @click="deny()"
      >
        Close
      </CommonButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps({
  method: {
    type: String,
    required: true,
  },
});

const { deny } = useRequestsStore();
</script>
