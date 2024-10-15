<template>
  <div class="h-full flex flex-col">
    <AccountHeader message="Sending from" />
    <h2 class="flex items-center justify-center text-white text-center text-3xl mt-6 font-semibold">
      <span v-if="preparingTransaction">
        <CommonContentLoader :length="15" />
      </span>
      <span
        v-else
        :title="formatUnits(transactionValue, chainBaseToken.decimals)"
      >
        -{{ formatAmount(transactionValue, chainBaseToken.decimals) }}
      </span>
      <span>
        &nbsp;
        <span v-if="preparingTransaction">
          <CommonContentLoader :length="8" />
        </span>
        <span v-else>{{ chainBaseToken.symbol }}</span>
        &nbsp;
      </span>
      <div class="w-8 h-8 rounded-full overflow-hidden">
        <CommonContentLoader
          v-if="preparingTransaction"
          class="block w-full h-full rounded-full"
        />
        <img
          v-else-if="chainBaseToken.iconUrl"
          :src="chainBaseToken.iconUrl"
          :alt="chainBaseToken.symbol"
          class="h-full w-full object-cover rounded-full"
        >
        <div
          v-else
          class="w-full h-full rounded-full bg-neutral-800"
        />
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
        <div class="w-4 h-4 rounded-full flex-shrink-0">
          <CommonContentLoader
            v-if="preparingTransaction"
            class="block w-full h-full rounded-full"
          />
          <Web3Avatar
            v-else
            :address="to"
            class="w-full h-full rounded-full"
          />
        </div>
        <span class="font-medium">
          &nbsp;
          <span v-if="preparingTransaction">
            <CommonContentLoader :length="20" />
          </span>
          <span v-else>{{ shortenAddress(to) }}</span>
        </span>
      </div>
    </div>
    <div class="text-lg flex justify-between mt-4">
      <div class="text-neutral-400">
        Fees
      </div>
      <div class="flex items-center">
        <span v-if="preparingTransaction">
          <CommonContentLoader :length="18" />&nbsp;<CommonContentLoader :length="8" />
        </span>
        <span
          v-else
        >{{ formatUnits(totalFee, 18) }} ETH</span>
        &nbsp;
        <div class="w-5 h-5 rounded-full bg-neutral-800">
          <CommonContentLoader
            v-if="preparingTransaction"
            class="block w-full h-full rounded-full"
          />
          <img
            v-else-if="chainBaseToken.iconUrl"
            :src="chainBaseToken.iconUrl"
            :alt="chainBaseToken.symbol"
            class="h-full w-full object-cover rounded-full"
          >
        </div>
      </div>
    </div>
    <div
      v-if="preparingFailed || responseError"
      class="text-xs text-error-500 border p-2 rounded-2xl border-error-500/30 mt-4 clip"
    >
      {{ preparingFailed || responseError }}
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
        :disabled="preparingTransaction"
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
import { formatUnits, type Address } from "viem";
import type { ExtractParams } from "zksync-account/client-gateway";
import { chainConfig, type ZksyncRpcTransaction } from "viem/zksync";
import { useIntervalFn } from "@vueuse/core";

const { appMeta } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { responseInProgress, responseError, request, requestChain } = storeToRefs(useRequestsStore());
const { getClient } = useClientStore();

const transactionParams = computed(() => {
  const params = request.value!.content.action.params as ExtractParams<"eth_sendTransaction">;
  // convert rpc formatted data to actual values (e.g. convert hex to BigInt)
  const formatted = chainConfig.formatters.transaction.format(params[0] as ZksyncRpcTransaction);
  return formatted;
});

const { result: preparedTransaction, inProgress: preparingTransaction, error: preparingFailed, execute: prepareTransaction } = useAsync(async () => {
  if (!request.value) return null;
  const client = getClient({ chainId: requestChain.value!.id });
  return await client.prepareTransactionRequest(transactionParams.value);
});
const { resume: resumeAutoReEstimation, pause: pauseAutoReEstimation } = useIntervalFn(async () => {
  if (responseInProgress.value) return;
  await prepareTransaction();
}, 20_000, { immediate: false }); // re-estimate every 20 seconds
watch(transactionParams, (val) => {
  if (!val) {
    preparedTransaction.value = null;
    pauseAutoReEstimation();
    return;
  }
  prepareTransaction();
  resumeAutoReEstimation();
}, { immediate: true });

const transactionValue = computed(() => {
  if (!preparedTransaction.value) {
    return 0n;
  }
  return preparedTransaction.value.value || 0n;
});
const chainBaseToken = computed(() => {
  return { symbol: "ETH", decimals: 18, iconUrl: "/img/eth.svg" };
});

const to = computed<Address | null>(() => {
  return preparedTransaction.value?.to || transactionParams.value.to || null;
});

const totalFee = computed<bigint>(() => {
  if (!preparedTransaction.value) return 0n;
  const { gas, maxFeePerGas, gasPrice } = preparedTransaction.value;
  if (gas && maxFeePerGas) {
    return gas * maxFeePerGas;
  } else if (gas && gasPrice) {
    return gas * gasPrice;
  }
  return 0n;
});

const confirmTransaction = async () => {
  respond(async () => {
    const client = getClient({ chainId: requestChain.value!.id });
    const transactionHash = await client.sendTransaction(transactionParams.value);
    return {
      result: {
        value: transactionHash,
      },
    };
  });
};
</script>
