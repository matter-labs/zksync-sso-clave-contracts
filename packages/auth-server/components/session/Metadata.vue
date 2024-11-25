<template>
  <div
    class="session-metadata"
    :class="`size-${size}`"
  >
    <div class="flex justify-center items-center isolate my-4">
      <Web3Avatar
        v-if="address"
        :address="address!"
        class="avatar-img rounded-full -z-[1] -mr-4"
      />
      <div class="app-icon-container rounded-md bg-neutral-800">
        <img
          v-if="appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-md"
        >
      </div>
    </div>
    <h1 class="text-white text-center text-2xl font-semibold">
      {{ message }}
    </h1>
    <p
      v-if="domain"
      class="text-center border border-neutral-800 bg-neutral-800/50 mt-3 mx-auto w-max px-4 py-1 rounded-3xl"
    >
      {{ domain }}
    </p>
  </div>
</template>

<script setup lang="ts">
import Web3Avatar from "web3-avatar-vue";
import type { AppMetadata } from "zksync-sso";

const props = withDefaults(defineProps<{
  appMeta: AppMetadata;
  address?: string | null;
  domain?: string;
  connect?: boolean;
  size?: "sm" | "md";
}>(), {
  size: "md",
});

const message = computed(() => {
  if (props.address || props.connect) {
    return `Connect to ${props.appMeta.name}`;
  } else {
    return `Authorize ${props.appMeta.name}`;
  }
});
</script>

<style lang="scss" scoped>
.session-metadata {
  &.size-sm {
    .avatar-img, .app-icon-container {
      @apply w-16 h-16;
    }
  }
  &.size-md {
    .avatar-img, .app-icon-container {
      @apply w-20 h-20;
    }
  }
}
</style>
