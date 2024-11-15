<template>
  <div class="flex items-center gap-4">
    <div class="text-sm flex items-center whitespace-nowrap truncate">
      <span class="text-neutral-400">{{ message }}&nbsp;</span>
      <Web3Avatar
        :address="address!"
        class="w-4 h-4 rounded-full flex-shrink-0"
      />
      <span
        class="font-medium"
        :title="address!"
      >&nbsp;{{ shortenAddress(address!) }}</span>
      <span
        v-if="requestChain"
        :title="requestChain.name"
        class="text-neutral-400 truncate"
      >&nbsp;on {{ requestChain.name }}</span>
    </div>
    <button
      class="ml-auto w-5 h-5 text-neutral-400 hover:text-white transition"
      data-testid="logout"
      @click="logoutAccount()"
    >
      <ArrowLeftEndOnRectangleIcon />
    </button>
  </div>
</template>

<script lang="ts" setup>
import { ArrowLeftEndOnRectangleIcon } from "@heroicons/vue/24/outline";
import Web3Avatar from "web3-avatar-vue";

defineProps({
  message: {
    type: String,
    required: true,
  },
});

const { logout } = useAccountStore();
const { address } = storeToRefs(useAccountStore());
const { requestChain } = storeToRefs(useRequestsStore());

const logoutAccount = () => {
  logout();
  navigateTo("/confirm");
};
</script>
