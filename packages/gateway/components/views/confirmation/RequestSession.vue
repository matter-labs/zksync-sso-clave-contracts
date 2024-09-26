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
import type { SessionPreferences, SessionData } from "zksync-account";
import type { GatewayRpcSchema, ExtractReturnType } from "zksync-account/client-gateway";
import { formatUnits, getAddress, type Address } from "viem";
import { ClockIcon, FingerPrintIcon } from "@heroicons/vue/24/outline";
import { privateKeyToAddress } from "viem/accounts";

const props = defineProps({
  session: {
    type: Object as PropType<SessionPreferences>,
    required: true,
  },
});

const { appMeta, origin } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { sessionKey } = storeToRefs(useAccountStore());
const { responseInProgress, requestChain } = storeToRefs(useRequestsStore());
const { fetchTokenInfo } = useTokenUtilities(computed(() => requestChain.value!.id));
const { getClient } = useClientStore();

const domain = computed(() => new URL(origin.value).host);
const sessionExpiresIn = useTimeAgo(props.session.expiresAt);

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
  const promises = Object.keys(props.session.spendLimit).map(async (tokenAddress) => fetchSingleToken(tokenAddress as Address));
  if (!Object.keys(props.session.spendLimit).includes(BASE_TOKEN_ADDRESS)) { // Fetch base token info if not present
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
    const client = getClient({ chainId: requestChain.value!.id });
    const sessionData: Omit<SessionData, "sessionKey"> = {
      expiresAt: props.session.expiresAt,
      spendLimit: props.session.spendLimit
        ? Object.fromEntries(Object.entries(props.session.spendLimit).map(
          ([tokenAddress, amount]) => [
            getAddress(tokenAddress.toLowerCase()),
            amount.toString(),
          ],
        ))
        : {},
    };
    /* TODO: this shouldn't pass a single token */
    const firstToken = {
      address: Object.keys(sessionData.spendLimit)[0] as Address,
      amount: Object.values(sessionData.spendLimit)[0],
    };
    const _session = await client.addSessionKey({
      sessionPublicKey: privateKeyToAddress(sessionKey.value!),
      token: firstToken.address,
      expiresAt: new Date(sessionData.expiresAt),
    });
    const response: ExtractReturnType<"eth_requestAccounts", GatewayRpcSchema> = {
      account: {
        address: client.account.address,
        activeChainId: client.chain.id,
        session: {
          ...sessionData,
          sessionKey: sessionKey.value!,
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
        contracts: contractsByChain[chain.id],
      })),
    };
    return {
      result: response,
    };
  });
};

fetchTokens();
</script>
