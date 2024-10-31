<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-4">
      ZKsync SSO Demo
    </h1>
    <button
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      @click="address ? disconnectWallet() : connectWallet()"
    >
      {{ address ? "Disconnect" : "Connect" }}
    </button>
    <div
      v-if="address"
      class="mt-4"
    >
      <p>Connected Address: {{ address }}</p>
    </div>
    <div
      v-if="address && balance"
      class="mt-4"
    >
      <p>Balance: {{ balance }}</p>
    </div>
    <button
      v-if="address"
      class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      @click="sendTokens()"
    >
      Send 0.1 ETH
    </button>

    <div
      v-if="errorMessage"
      class="p-4 mt-4 mb-4 max-w-96 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
    >
      <span class="font-medium">{{ errorMessage }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { disconnect, getBalance, watchAccount, sendTransaction, createConfig, connect, reconnect } from "@wagmi/core";
import { zksyncAccountConnector } from "zksync-account/connector";
import { zksyncInMemoryNode } from "@wagmi/core/chains";
import { http, parseEther, type Address } from "viem";

useHead({
  title: "ZKsync SSO Demo App",
});

const testTransferTarget = "0x55bE1B079b53962746B2e86d12f158a41DF294A6";
const testTransferAmount = parseEther("0.1");
const zksyncConnector = zksyncAccountConnector({
  gatewayUrl: "http://localhost:3002/confirm",
  session: {
    feeLimit: parseEther("0.1"),
    transferPolicies: [
      {
        target: testTransferTarget,
        valueLimit: testTransferAmount,
      },
    ],
  },
});
const wagmiConfig = createConfig({
  chains: [zksyncInMemoryNode],
  connectors: [zksyncConnector],
  transports: {
    [zksyncInMemoryNode.id]: http(),
  },
});
reconnect(wagmiConfig);

const address = ref<Address | null>(null);
const balance = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const updateBalance = async () => {
  if (!address.value) {
    balance.value = null;
    return;
  }
  const currentBalance = await getBalance(wagmiConfig, {
    address: address.value,
  });
  balance.value = `${currentBalance.formatted} ${currentBalance.symbol}`;
};

// Check for updates to the current account
watchAccount(wagmiConfig, {
  async onChange(data) {
    address.value = data.address || null;
  },
});
watch(address, () => {
  updateBalance();
}, { immediate: true });

const connectWallet = async () => {
  try {
    errorMessage.value = "";
    connect(wagmiConfig, {
      connector: zksyncConnector,
      chainId: zksyncInMemoryNode.id,
    });
  } catch (error) {
    errorMessage.value = "Connect failed, see console for more info.";
    // eslint-disable-next-line no-console
    console.error("Connection failed:", error);
  }
};

const disconnectWallet = async () => {
  await disconnect(wagmiConfig);
};

const sendTokens = async () => {
  if (!address.value) return;

  errorMessage.value = "";
  try {
    await sendTransaction(wagmiConfig, {
      to: testTransferTarget,
      value: parseEther("0.1"),
      gas: 100_000_000n,
    });

    await updateBalance();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactionFailureDetails = (error as any).cause?.cause?.cause?.data?.originalError?.cause?.details;
    if (!transactionFailureDetails) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactionFailureDetails = (error as any).cause?.cause?.data?.originalError?.cause?.details;
    }

    if (transactionFailureDetails) {
      errorMessage.value = transactionFailureDetails;
    } else {
      errorMessage.value = "Transaction failed, see console for more info.";
      // eslint-disable-next-line no-console
      console.error("Transaction failed:", error);
    }
  }
};
</script>
