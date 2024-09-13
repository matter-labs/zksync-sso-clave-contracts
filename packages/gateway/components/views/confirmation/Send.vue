<template>
  <div class="h-full flex flex-col">
    <AccountHeader message="Sending from" />
    <h2 class="flex items-center justify-center text-white text-center text-3xl mt-6 font-semibold">
      <span :title="formatUnits(BigInt(tokenAndAmount.amount), tokenAndAmount.token.decimals)">
        -{{ formatAmount(BigInt(tokenAndAmount.amount), tokenAndAmount.token.decimals) }}
      </span>
      <span>&nbsp;{{ tokenAndAmount.token.symbol }}&nbsp;</span>
      <div class="w-8 h-8 rounded-full bg-neutral-800">
        <img
          v-if="tokenAndAmount.token.iconUrl"
          :src="tokenAndAmount.token.iconUrl"
          :alt="tokenAndAmount.token.symbol"
          class="h-full w-full object-cover rounded-full"
        >
      </div>
    </h2>
    <div class="text-lg flex justify-between mt-12">
      <div class="text-neutral-400">
        Sending to
      </div>
      <div
        v-if="to"
        class="flex items-center"
      >
        <Web3Avatar
          :address="to"
          class="w-4 h-4 rounded-full"
        />
        <span class="font-medium">&nbsp;{{ shortenAddress(to) }}</span>
      </div>
    </div>
    <div class="text-lg flex justify-between mt-4">
      <div class="text-neutral-400">
        Fees
      </div>
      <div
        v-if="totalFee"
        class="flex items-center"
      >
        <span>{{ formatUnits(totalFee, 18) }} ETH&nbsp;</span>
        <div class="w-5 h-5 rounded-full bg-neutral-800">
          <img
            v-if="tokenAndAmount.token.iconUrl"
            :src="tokenAndAmount.token.iconUrl"
            :alt="tokenAndAmount.token.symbol"
            class="h-full w-full object-cover rounded-full"
          >
        </div>
      </div>
    </div>
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
        @click="confirmTransaction()"
      >
        Confirm
      </CommonButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Web3Avatar from "web3-avatar-vue";
import { formatUnits, type Hash } from "viem";
import { type SerializedEthereumRpcError } from "zksync-account/errors";

const { appMeta } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { responseInProgress, request } = storeToRefs(useRequestsStore());
const { getClient } = useClientStore();

const tokenAndAmount = computed(() => {
  const defaultValue = { amount: "0", token: { symbol: "ETH", decimals: 18, iconUrl: "/img/eth.svg" } };
  if (!request.value) return defaultValue;
  if (!request.value.request.action?.params?.length) return defaultValue;
  const { value } = request.value.request.action.params[0];
  if (!value) return defaultValue;
  return {
    amount: value,
    token: defaultValue.token,
  };
});

const to = computed<Hash | null>(() => {
  if (!request.value?.request.action?.params?.length) return null;
  const { to } = request.value.request.action.params[0];
  return to || null;
});

const totalFee = computed<bigint | null>(() => {
  if (!request.value?.request.action?.params?.length) return null;
  const { gas, gasPrice } = request.value.request.action.params[0];
  return gas && gasPrice ? BigInt(gas) * BigInt(gasPrice) : null;
});

const confirmTransaction = async () => {
  respond(async () => {
    const client = getClient({ chainId: request.value!.request.chainId });
    const params = request.value!.request.action.params;
    const transactionParams: { from: Hash; to: Hash; gas: Hash; gasPrice: Hash; type: Hash; value: Hash } = params[0];
    try {
      const transactionHash = await client.sendTransaction({
        chain: client.chain,
        gas: BigInt(transactionParams.gas),
        gasPrice: BigInt(transactionParams.gasPrice),
        to: transactionParams.to,
        value: BigInt(transactionParams.value),
      });
      return {
        result: {
          value: transactionHash,
        },
      };
    } catch (error) {
      return {
        failure: error as SerializedEthereumRpcError,
      };
    }
  });
};
</script>
