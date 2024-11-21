<template>
  <SessionTemplate>
    <template #header>
      <SessionAccountHeader
        message="Sending from"
      />
    </template>

    <CommonAlert>
      <template #icon>
        <InformationCircleIcon aria-hidden="true" />
      </template>
      <template #default>
        <p class="text-sm">
          UI for non-session transactions is currently in an early development stage and remains a work-in-progress.
        </p>
      </template>
    </CommonAlert>

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

    <button
      class="mx-auto mt-4 text-center w-max px-4 py-2 flex items-center gap-1 text-sm text-neutral-700 hover:text-neutral-600 transition-colors"
      @click="advancedInfoOpened = !advancedInfoOpened"
    >
      <span>{{ advancedInfoOpened ? 'Hide' : 'Show' }} advanced transaction info</span>
      <ChevronDownIcon
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': advancedInfoOpened }"
        aria-hidden="true"
      />
    </button>
    <CommonHeightTransition :opened="advancedInfoOpened">
      <CommonLine>
        <pre class="p-3 text-xs overflow-auto">{{ JSON.stringify(transactionParams, null, 4) }}</pre>
      </CommonLine>
    </CommonHeightTransition>

    <template #footer>
      <div class="flex gap-4">
        <ZkButton
          class="w-full"
          type="secondary"
          @click="deny()"
        >
          Cancel
        </ZkButton>
        <ZkButton
          class="w-full"
          :disabled="preparingTransaction"
          :loading="!appMeta || responseInProgress"
          data-testid="confirm"
          @click="confirmTransaction()"
        >
          Confirm
        </ZkButton>
      </div>
    </template>
  </SessionTemplate>
</template>

<script lang="ts" setup>
import { InformationCircleIcon } from "@heroicons/vue/20/solid";
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { useIntervalFn } from "@vueuse/core";
import { type Address, formatUnits, type SendTransactionRequest } from "viem";
import { chainConfig, type ZksyncRpcTransaction } from "viem/zksync";
import Web3Avatar from "web3-avatar-vue";
import type { ExtractParams } from "zksync-sso/client-auth-server";

const { appMeta } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { responseInProgress, responseError, request, requestChain } = storeToRefs(useRequestsStore());
const { getClient } = useClientStore();

const transactionParams = computed(() => {
  const params = request.value!.content.action.params as ExtractParams<"eth_sendTransaction">;
  // convert rpc formatted data to actual values (e.g. convert hex to BigInt)
  const formatted = chainConfig.formatters.transaction.format(params[0] as ZksyncRpcTransaction);
  return formatted as SendTransactionRequest;
});

const advancedInfoOpened = ref(false);

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
