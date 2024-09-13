<template>
  <div class="h-full flex flex-col">
    <AccountHeader message="Connecting with" />
    <div class="w-14 h-14 rounded-full bg-neutral-800 mx-auto">
      <img
        v-if="appMeta.icon"
        :src="appMeta.icon"
        :alt="appMeta.name"
        class="h-full w-full object-cover rounded-full"
      >
    </div>
    <h1 class="text-white text-center text-xl mt-2 font-semibold">
      Authorize {{ appMeta.name }}
    </h1>
    <p class="text-neutral-300 text-center bg-neutral-900 mt-2 mx-auto w-max px-2 py-1 rounded-3xl justify-center">
      {{ domain }}
    </p>
    <div class="space-y-2 mt-4">
      <div class="font-medium">
        Permissions
      </div>
      <CommonButtonLine
        size="sm"
        as="div"
      >
        <div class="flex items-center gap-2 py-2">
          <FingerPrintIcon class="text-neutral-400 w-8 h-8" />
          <div>Act on your behalf</div>
        </div>
        <div class="flex items-center gap-2 py-2">
          <ClockIcon class="text-neutral-400 w-8 h-8" />
          <div>Expires {{ sessionExpiresIn }}</div>
        </div>
      </CommonButtonLine>
      <div class="font-medium">
        Allowed spending
      </div>
      <CommonLine>
        <template v-if="totalUsd > 0">
          <CommonButtonLine
            as="div"
            size="sm"
            class="flex justify-between"
          >
            <div class="font-medium">
              Total
            </div>
            <div>{{ formatPricePretty(totalUsd) }}</div>
          </CommonButtonLine>
          <div class="border border-dashed border-neutral-800" />
        </template>
        <div>
          <template v-if="tokensLoading">
            <TokenAmountLoader
              v-for="item in Object.keys(props.session.spendLimit)"
              :key="item"
            />
          </template>
          <template v-else>
            <TokenAmount
              v-for="item in spendLimitTokens"
              :key="item.token.address"
              as="div"
              size="sm"
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
    <div class="mt-auto flex gap-4 pt-4">
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
import { useTimeAgo } from "@vueuse/core";
import { type SessionPreferences, type SessionData } from "zksync-account";
import { type HandshakeResponse } from "zksync-account/client-gateway";
import { $fetch } from "ofetch";
import { formatUnits, getAddress, type Address } from "viem";
import { ClockIcon, FingerPrintIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  session: {
    type: Object as PropType<SessionPreferences>,
    required: true,
  },
});

const { appMeta, origin } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { request, responseInProgress, requestChain } = storeToRefs(useRequestsStore());
const { getClient } = useClientStore();

const domain = computed(() => new URL(origin.value).host);
const sessionExpiresIn = useTimeAgo(props.session.validUntil);

const { result: tokensList, inProgress: tokensLoading, execute: fetchTokens } = useAsync(async () => {
  const fetchSingleToken = async (tokenAddress: Address): Promise<Token> => {
    try {
      const { result } = await $fetch<{
        result: {
          tokenName: string;
          symbol: string;
          tokenDecimal: string;
          tokenPriceUSD: string;
          iconURL: string;
        }[];
      }>(`${blockExplorerApiByChain[requestChain.value!.id]}?module=token&action=tokeninfo&contractaddress=${tokenAddress}`);
      const tokenInfo = result[0];
      return {
        address: tokenAddress,
        name: tokenInfo.tokenName,
        symbol: tokenInfo.symbol,
        decimals: parseInt(tokenInfo.tokenDecimal),
        price: parseFloat(tokenInfo.tokenPriceUSD),
        iconUrl: tokenInfo.iconURL,
      };
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
  const promises = Object.keys(props.session.spendLimit).map(async (tokenAddress) => fetchSingleToken(tokenAddress as Address));
  if (!Object.keys(props.session.spendLimit).includes(BASE_TOKEN_ADDRESS)) {
    promises.push(fetchSingleToken(BASE_TOKEN_ADDRESS));
  }
  return Object.fromEntries((await Promise.all(promises)).map((e) => [e.address, e]));
});

const spendLimitTokens = computed(() => {
  if (!props.session || !tokensList.value) return;
  return Object.entries(props.session.spendLimit).map(([tokenAddress, amount]) => ({
    token: tokensList.value![tokenAddress],
    amount,
  }));
});

const totalUsd = computed(() => (spendLimitTokens.value || []).reduce((acc, item) => {
  if (!item.token.price) return acc;
  const formattedTokenAmount = formatUnits(BigInt(item.amount), item.token.decimals);
  return acc + (parseFloat(formattedTokenAmount) * item.token.price);
}, 0));

const confirmConnection = async () => {
  respond(async () => {
    const client = getClient({ chainId: request.value!.request.chainId });
    const sessionData: Omit<SessionData, "sessionKey"> = {
      validUntil: props.session.validUntil,
      spendLimit: props.session.spendLimit
        ? Object.fromEntries(Object.entries(props.session.spendLimit).map(
          ([tokenAddress, amount]) => [
            getAddress(tokenAddress.toLowerCase()),
            amount.toString(),
          ],
        ))
        : {},
    };
    const session = await client.requestSession(sessionData);
    const response: HandshakeResponse = {
      result: {
        account: {
          address: client.account.address,
          activeChainId: client.chain.id,
          session: {
            ...sessionData,
            sessionKey: session.sessionKey,
          },
        },
        chainsInfo: supportedChains.map((chain) => ({
          id: chain.id,
          capabilities: {
            paymasterService: {
              supported: true,
            },
            atomicBatch: {
              supported: true,
            },
            auxiliaryFunds: {
              supported: true,
            },
          },
          contracts: {
            session: "0xa1cf087DB965Ab02Fb3CFaCe1f5c63935815f044",
          },
        })),
      },
    };
    return response;
  });
};

fetchTokens();
</script>
