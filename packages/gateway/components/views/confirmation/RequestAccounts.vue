<template>
  <div class="h-full flex flex-col">
    <AccountHeader message="Connecting with" />
    <div class="flex justify-center items-center isolate mt-6">
      <Web3Avatar
        :address="address!"
        class="w-20 h-20 rounded-full -z-[1] -mr-4"
      />
      <div class="w-20 h-20 rounded-full bg-neutral-800">
        <img
          v-if="appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-full"
        >
      </div>
    </div>
    <h1 class="text-white text-center text-2xl mt-4 font-semibold">
      Connect to {{ appMeta.name }}
    </h1>
    <p class="text-neutral-400 text-center mt-2">
      {{ domain }}
    </p>
    <ul class="mt-6 text-neutral-300">
      <li class="flex items-center gap-4 leading-tight my-4">
        <CheckIcon class="w-6 h-6 text-primary-300 shrink-0" />
        Let it see your address, balance and activity
      </li>
      <li class="flex items-center gap-4 leading-tight my-4">
        <CheckIcon class="w-6 h-6 text-primary-300 shrink-0" />
        Let it send you requests for transactions
      </li>
      <li class="flex items-center gap-4 leading-tight my-4">
        <CheckIcon class="w-6 h-6 text-primary-300 shrink-0" />
        Funds will not leave your account without your confirmation
      </li>
    </ul>
    <div class="mt-auto flex gap-4">
      <CommonButton
        class="w-full"
        variant="neutral"
        @click="deny()"
      >
        Cancel
      </CommonButton>
      <CommonButton
        class="w-full"
        :loading="!appMeta || responseInProgress"
        @click="confirmConnection()"
      >
        Connect
      </CommonButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Web3Avatar from "web3-avatar-vue";
import { CheckIcon } from "@heroicons/vue/24/outline";

const { appMeta, domain } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { responseInProgress } = storeToRefs(useRequestsStore());
const { address } = storeToRefs(useAccountStore());

const confirmConnection = () => {
  respond(() => ({
    result: {
      value: [address.value!],
    },
  }));
};
</script>
