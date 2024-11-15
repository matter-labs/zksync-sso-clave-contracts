<template>
  <div
    v-if="tokensLoading || spendLimitTokens?.length"
    class="bg-neutral-975 rounded-[28px]"
  >
    <div class="px-5 py-2 text-neutral-400">
      <div class="flex justify-between">
        <div>Allowed spending</div>
        <div v-if="totalUsd">
          {{ formatPricePretty(totalUsd) }}
        </div>
      </div>
    </div>
    <CommonLine>
      <div class="divide-y divide-neutral-900">
        <template v-if="tokensLoading">
          <TokenAmountLoader
            v-for="item in []"
            :key="item"
            variant="headless"
          />
        </template>
        <template v-else>
          <TokenAmount
            v-for="item in spendLimitTokens"
            :key="item.token.address"
            as="div"
            size="sm"
            variant="headless"
            :symbol="item.token.symbol"
            :decimals="item.token.decimals"
            :address="item.token.address"
            :price="item.token.price"
            :icon-url="item.token.iconUrl"
            :amount="item.amount.toString()"
          />
        </template>
      </div>
    </CommonLine>
  </div>
</template>

<script setup lang="ts">
import { formatUnits } from "viem";
import type { Address } from "viem/accounts";
import type { SessionConfig } from "zksync-sso/utils";

const { requestChain } = storeToRefs(useRequestsStore());
const { fetchTokenInfo } = useTokenUtilities(computed(() => requestChain.value!.id));

interface Props {
  session: Omit<SessionConfig, "signer">;
}

const props = defineProps<Props>();

const { result: tokensList, inProgress: tokensLoading, execute: fetchTokens } = useAsync(async () => {
  const fetchSingleToken = async (tokenAddress: Address): Promise<Token> => {
    try {
      return fetchTokenInfo(tokenAddress);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to fetch token info for ${tokenAddress}`, error);
      return {
        address: tokenAddress,
        name: "Unknown",
        symbol: "unknown",
        decimals: 0,
      };
    }
  };
  /* const promises = (props.session.transferPolicies || []).map(async (tokenAddress) => fetchSingleToken(tokenAddress as Address));
  if (!Object.keys(props.session.spendLimit).includes(BASE_TOKEN_ADDRESS)) { // Fetch base token info if not present
    promises.push(fetchSingleToken(BASE_TOKEN_ADDRESS));
  } */
  const promises = [fetchSingleToken(BASE_TOKEN_ADDRESS)];
  return Object.fromEntries((await Promise.all(promises)).map((e) => [e.address, e]));
});

const spendLimitTokens = computed(() => {
  if (!props.session || !tokensList.value) return;
  let spendLimits: { [tokenAddress: string]: bigint } = {
    [BASE_TOKEN_ADDRESS]: props.session.feeLimit?.limit,
  };
  spendLimits = (props.session.transferPolicies || []).reduce((acc, transferPolicy) => {
    return {
      ...acc,
      [BASE_TOKEN_ADDRESS]: (acc[BASE_TOKEN_ADDRESS] || BigInt(0)) + BigInt(transferPolicy.valueLimit.limit),
    };
  }, spendLimits);
  return Object.entries(spendLimits)
    .filter(([,amount]) => amount > 0n)
    .map(([tokenAddress, amount]) => ({
      token: tokensList.value![tokenAddress],
      amount,
    }));
});

const totalUsd = computed(() => (spendLimitTokens.value || []).reduce((acc, item) => {
  if (!item.token.price) return acc;
  const formattedTokenAmount = formatUnits(BigInt(item.amount), item.token.decimals);
  return acc + (parseFloat(formattedTokenAmount) * item.token.price);
}, 0));

fetchTokens();
</script>
