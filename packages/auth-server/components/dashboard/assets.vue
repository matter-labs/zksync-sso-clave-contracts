<template>
  <ZkPanelSection
    title="Assets"
    :ui="{ title: 'py-2', footer: 'flex justify-center' }"
  >
    <ZkTableBody>
      <template v-if="filteredBalances.length === 0">
        <ZkTableRow>
          <div class="w-full text-center text-neutral-500 py-4 flex items-center justify-center">
            <ZkIcon
              icon="savings"
              class="mr-2 !text-4xl"
            />
            We can't find any balances related to this account.
          </div>
        </ZkTableRow>
      </template>
      <template v-else>
        <ZkTableRow
          v-for="(balance, balanceAddress) in filteredBalances"
          :key="balanceAddress"
        >
          <ZkTableCellData>
            <img
              v-if="balance.token.iconURL"
              :src="balance.token.iconURL"
              alt="Thumbnail"
              class="w-12 h-12 rounded"
            >
            <ZkIconThumbnail
              v-else
              :icon="'toll'"
            />
          </ZkTableCellData>
          <ZkTableCellData class="flex-auto">
            {{ balance.token.symbol }}
            <template
              v-if="balance.token.name"
              #sub
            >
              {{ balance.token.name }}
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            <span class="font-bold">
              {{ formatUnits(BigInt(balance.balance), balance.token.decimals) }}
            </span>
            <template
              v-if="balance.token.usdPrice"
              #sub
            >
              {{ formatBalance(balance.token.usdValue) }}
            </template>
          </ZkTableCellData>
        </ZkTableRow>
      </template>
    </ZkTableBody>
    <template
      v-if="hasMoreToShow"
      #footer
    >
      <ZkButton
        type="secondary"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : `View all (${Object.entries(assets?.balances || {}).filter(([, balance]) => balance.token !== null).length})` }}
      </ZkButton>
    </template>
  </ZkPanelSection>
</template>

<script setup lang="ts">
import { type Address, formatUnits } from "viem";

const runtimeConfig = useRuntimeConfig();
const { address } = useAccountStore();
const chainId = runtimeConfig.public.chainId as SupportedChainId;
const assets = ref<GetAddressInfoResponse | null>(null);

const showLimit = 5;
const showAll = ref(false);
const hasMoreToShow = ref(false);

const filteredBalances = computed(() => {
  const balances = Object.entries(assets.value?.balances || {})
    .filter(([, balance]) => balance.token !== null)
    .map(([address, balance]) => ({ address, ...balance }))
    .map((aBalance) => {
      aBalance.token.usdValue = (+formatUnits(BigInt(aBalance.balance) * BigInt(Math.round(aBalance.token.usdPrice * 10000000000)) / BigInt(10000000000), aBalance.token.decimals));
      return aBalance;
    })
    .sort((a, b) => b.token.usdValue - a.token.usdValue);

  if (!showAll.value) return balances.slice(0, showLimit);
  return balances;
});

watch(assets, () => {
  if (Object.entries(assets.value?.balances || {}).length > showLimit) {
    hasMoreToShow.value = true;
  }
});

const formatBalance = (balance: number) => {
  if (balance < 0.01) {
    return "< $0.01";
  } else {
    return balance.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
};

interface GetAddressInfoResponse {
  type: string;
  address: string;
  blockNumber: number;
  balances: {
    [key: Address]: TokenBalance;
  };
  sealedNonce: number;
  verifiedNonce: number;
}

interface TokenBalance {
  balance: string;
  token: Token;
}

interface Token {
  l2Address: string;
  l1Address: string;
  symbol: string;
  name: string;
  decimals: number;
  usdPrice: number;
  liquidity: number;
  iconURL: string;
  usdValue: number;
}

// Get Address Info
const blockExplorerUrl = blockExplorerApiByChain[chainId].replace(/\/api$/, "");
const getAddressInfoUrl = `${blockExplorerUrl}/address/${address}`;
const { data: getAddressInfoResponse } = await useFetch(getAddressInfoUrl);
assets.value = await getAddressInfoResponse.value as GetAddressInfoResponse;
</script>
