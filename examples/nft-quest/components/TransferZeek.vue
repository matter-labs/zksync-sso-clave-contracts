<template>
  <div>
    <div
      v-if="!successMint"
      class="p-2"
    >
      Mint another copy and send to a friend
    </div>
    <div
      v-else
      class="p-2"
    >
      <span class="block font-semibold text-neutral-100">
        <ZkIcon
          icon="check"
          class="text-success-400"
        />
        You've sent the minted copy to {{ addressSentTo }}
      </span>
      <span class="text-sm text-neutral-500 leading-3">The NFT is minted and sent using a Paymaster and a Session key.</span>
    </div>
    <ZkInput
      v-model="walletAddress"
      placeholder="Wallet address"
      required
    />
    <div class="flex flex-col lg:flex-row items-center gap-4 pt-3">
      <ZkLink
        v-if="successMint"
        :to="transactionURL"
        target="_blank"
        type="secondary"
        class="w-full lg:mt-0"
      >
        Transaction details
        <ZkIcon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-2 -my-0.5"
        />
      </ZkLink>
      <ZkButton
        type="primary"
        class="uppercase w-full"
        :loading="status === 'pending'"
        @click="mintForFriend"
      >
        Mint and send {{ successMint ? "again" : "" }}
      </ZkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Address, isAddress } from "viem";

const walletAddress = ref("");
const addressSentTo = ref("");
const { execute: mintNFT, status, data } = await useMintNft(walletAddress as Ref<Address>);

watch(status, () => {
  if (status.value === "pending") {
    addressSentTo.value = useTruncateAddress(walletAddress.value as `0x${string}`) as string;
  }
});

const successMint = computed(() => {
  return status.value === "success";
});

const runtimeConfig = useRuntimeConfig();
const transactionURL = computed(() => {
  return `${runtimeConfig.public.explorerUrl}/tx/${data.value!.transactionHash}`;
});

const disabled = computed(() => {
  return walletAddress.value.length === 0 && !isAddress(walletAddress.value);
});

const mintForFriend = () => {
  if (disabled.value) return;
  mintNFT();
};
</script>
