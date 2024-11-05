<template>
  <div class="h-dvh flex flex-col px-4">
    <AccountHeader message="Connecting with" />
    <div class="w-14 h-14 rounded-md bg-neutral-950 mx-auto flex-shrink-0">
      <img
        v-if="appMeta.icon"
        :src="appMeta.icon"
        :alt="appMeta.name"
        class="h-full w-full object-cover rounded-md"
      >
    </div>
    <h1 class="text-white text-center text-xl mt-2 font-semibold">
      Authorize {{ appMeta.name }}
    </h1>
    <p class="text-center border border-neutral-900 mt-2 mx-auto w-max px-4 py-1 rounded-3xl">
      {{ domain }}
    </p>
    <div class="space-y-2 mt-4">
      <div class="bg-neutral-975 rounded-[28px]">
        <div class="px-5 py-2 text-neutral-400">
          Permissions
        </div>
        <CommonLine>
          <div class="divide-y divide-neutral-900">
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsFingerprint class="w-7 h-7" />
              <div>Act on your behalf</div>
            </div>
            <div class="flex items-center gap-2 py-3 px-3">
              <IconsClock class="w-7 h-7" />
              <div>Expires {{ sessionExpiresIn }}</div>
            </div>
          </div>
        </CommonLine>
      </div>

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
    </div>

    <button
      class="mx-auto text-center w-max px-4 py-2 flex items-center gap-1 text-sm text-neutral-800 hover:text-neutral-600 transition-colors"
      @click="advancedInfoOpened = !advancedInfoOpened"
    >
      <span>{{ advancedInfoOpened ? 'Hide' : 'Show' }} advanced session info</span>
      <ChevronDownIcon
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': advancedInfoOpened }"
        aria-hidden="true"
      />
    </button>
    <CommonHeightTransition :opened="advancedInfoOpened">
      <CommonLine>
        <pre class="p-3 text-xs overflow-auto">{{ JSON.stringify(formattedSession, null, 4) }}</pre>
      </CommonLine>
    </CommonHeightTransition>

    <div class="mt-auto">
      <div class="-mx-3 px-3 border-t border-neutral-900 flex gap-4 py-4 mt-2">
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
  </div>
</template>

<script lang="ts" setup>
import { ChevronDownIcon } from "@heroicons/vue/24/outline";
import { useTimeAgo } from "@vueuse/core";
import { type Address, formatUnits } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import type { SessionPreferences } from "zksync-sso";
import type { AuthServerRpcSchema, ExtractReturnType } from "zksync-sso/client-auth-server";
import { getSession } from "zksync-sso/utils";

const props = defineProps({
  session: {
    type: Object as PropType<SessionPreferences>,
    required: true,
  },
});

const { appMeta, origin } = useAppMeta();
const { respond, deny } = useRequestsStore();
const { responseInProgress, requestChain } = storeToRefs(useRequestsStore());
const { fetchTokenInfo } = useTokenUtilities(computed(() => requestChain.value!.id));
const { getClient } = useClientStore();
const formattedSession = computed(() => getSession(props.session));

const domain = computed(() => new URL(origin.value).host);
const sessionExpiresIn = useTimeAgo(Number(formattedSession.value.expiresAt) * 1000);

const advancedInfoOpened = ref(false);

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
  if (!formattedSession.value || !tokensList.value) return;
  let spendLimits: { [tokenAddress: string]: bigint } = {
    [BASE_TOKEN_ADDRESS]: formattedSession.value.feeLimit.limit,
  };
  spendLimits = (formattedSession.value.transferPolicies || []).reduce((acc, transferPolicy) => {
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

const confirmConnection = async () => {
  respond(async () => {
    const client = getClient({ chainId: requestChain.value!.id });
    const sessionKey = generatePrivateKey();
    const sessionPreferences = formattedSession.value;

    const _session = await client.createSession({
      session: {
        ...sessionPreferences,
        sessionPublicKey: privateKeyToAddress(sessionKey),
      },
    });
    const response: ExtractReturnType<"eth_requestAccounts", AuthServerRpcSchema> = {
      account: {
        address: client.account.address,
        activeChainId: client.chain.id,
        session: {
          ...sessionPreferences,
          sessionKey,
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
