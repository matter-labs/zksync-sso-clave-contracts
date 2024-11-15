<template>
  <div>
    <div class="flex justify-center items-center isolate mt-6 mb-8">
      <Web3Avatar
        v-if="address"
        :address="address!"
        class="w-20 h-20 rounded-full -z-[1] -mr-4"
      />
      <div class="w-20 h-20 rounded-md bg-neutral-800">
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
      class="text-center border border-neutral-800 bg-neutral-800/50 mt-2 mx-auto w-max px-4 py-1 rounded-3xl"
    >
      {{ domain }}
    </p>
  </div>
</template>

<script setup lang="ts">
import Web3Avatar from "web3-avatar-vue";
import type { AppMetadata } from "zksync-sso";

const props = defineProps<{
  appMeta: AppMetadata;
  address?: string | null;
  domain?: string;
  connect?: boolean;
}>();

const message = computed(() => {
  if (props.address || props.connect) {
    return `Connect to ${props.appMeta.name}`;
  } else {
    return `Authorize ${props.appMeta.name}`;
  }
});
</script>
