<template>
  <div
    v-if="tokensLoading || spendLimitTokens.length || onchainActionsCount"
    class="bg-neutral-975 rounded-[28px] text-neutral-100"
  >
    <div class="pl-5 pr-3 py-2 text-neutral-400">
      <div class="flex justify-between">
        <div>Allowed spending</div>
        <div v-if="!hasUnlimitedSpend">
          <CommonContentLoader
            v-if="tokensLoading"
            :length="12"
          />
          <span v-else>
            {{ totalUsd ? formatPricePretty(totalUsd) : formatPricePretty(0) }}
          </span>
        </div>
      </div>
    </div>
    <CommonLine>
      <div class="divide-y divide-neutral-900">
        <template v-if="tokensLoading">
          <TokenAmountLoader
            v-for="item in 1"
            :key="item"
            size="sm"
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
        <div class="py-2.5 text-center text-sm text-neutral-400">
          <span v-if="spendLimitTokens.length">And</span>
          {{ onchainActionsCount }} onchain action{{ onchainActionsCount > 1 ? 's' : '' }}...
        </div>
      </div>
    </CommonLine>
  </div>
</template>

<script setup lang="ts">
import { useNow } from "@vueuse/core";
import { FetchError } from "ofetch";
import { erc20Abi, formatUnits, toFunctionSelector } from "viem";
import type { Address } from "viem/accounts";
import { type Limit, LimitType, LimitUnlimited, type SessionConfig } from "zksync-sso/utils";

const { requestChain } = storeToRefs(useRequestsStore());
const { fetchTokenFromBlockExplorerApi } = useTokenUtilities(computed(() => requestChain.value!.id));

const props = defineProps<{
  session: Omit<SessionConfig, "signer">;
}>();

const now = useNow({ interval: 5000 });

const onchainActionsCount = computed(() => {
  return props.session.callPolicies.length + props.session.transferPolicies.length;
});

const { result: tokensList, inProgress: tokensLoading, execute: fetchTokens } = useAsync(async () => {
  const contracts: Address[] = [BASE_TOKEN_ADDRESS, ...props.session.callPolicies.map((policy) => policy.target)];
  const tokens: Token[] = (await Promise.all(contracts.map(async (contract) => {
    return await fetchTokenFromBlockExplorerApi(contract)
      .catch((error) => {
        if (contract === BASE_TOKEN_ADDRESS) {
          return {
            address: BASE_TOKEN_ADDRESS,
            name: requestChain.value!.nativeCurrency.name,
            symbol: requestChain.value!.nativeCurrency.symbol,
            decimals: requestChain.value!.nativeCurrency.decimals,
          };
        }
        if (error instanceof FetchError && error.statusCode === 404) return undefined;
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch token info for ${contract}`, error);
        return undefined;
      });
  }))).filter((e) => !!e);
  return tokens;
});

const calculateMaxPeriodSpend = (args: { sessionStartsAt: Date; sessionExpiresAt: bigint; limitPerPeriod: bigint; period: bigint }) => {
  // `limitPerPeriod` has cumulative effect, and every `period` seconds it resets
  const startDate = args.sessionStartsAt;
  const expiryDate = new Date(Number(args.sessionExpiresAt) * 1000);
  const period = Number(args.period) * 1000;
  // 1n means initial limit
  const limitResetsCount = 1n + BigInt(Math.floor((expiryDate.getTime() - startDate.getTime()) / period));
  return limitResetsCount * args.limitPerPeriod;
};

const limitsByToken = computed(() => {
  const limits: { [tokenAddress: Address ]: bigint | "unlimited" } = {};

  const createTokenEntry = (token: Address) => {
    if (!limits[token]) {
      limits[token] = 0n;
    }
  };
  const addLifetimeLimit = (token: Address, limit: bigint | "unlimited") => {
    createTokenEntry(token);
    if (limits[token] === "unlimited") return;
    if (limit === "unlimited") {
      limits[token] = "unlimited";
    } else {
      limits[token] += limit;
    }
  };
  const addPeriodLimit = (token: Address, limit: bigint, period: bigint) => {
    createTokenEntry(token);
    const maxSpend = calculateMaxPeriodSpend({
      sessionStartsAt: now.value,
      sessionExpiresAt: props.session.expiresAt,
      limitPerPeriod: limit,
      period,
    });
    addLifetimeLimit(token, maxSpend);
  };
  const addLimit = (token: Address, limit: Limit) => {
    if (limit.limitType === LimitType.Lifetime) {
      addLifetimeLimit(token, limit.limit);
    } else if (limit.limitType === LimitType.Allowance) {
      addPeriodLimit(token, limit.limit, limit.period);
    } else if (limit.limitType === LimitType.Unlimited) {
      addLifetimeLimit(token, "unlimited");
    }
  };

  addLimit(BASE_TOKEN_ADDRESS, props.session.feeLimit);

  for (const policy of props.session.transferPolicies) {
    addLimit(BASE_TOKEN_ADDRESS, policy.valueLimit);
  }
  for (const policy of props.session.callPolicies) {
    addLimit(BASE_TOKEN_ADDRESS, policy.valueLimit);
    const token = tokensList.value?.find((token) => token.address === policy.target);
    if (!token) continue;

    const transferAbi = erc20Abi.find((e) => e.type === "function" && e.name === "transfer")!;
    const approveAbi = erc20Abi.find((e) => e.type === "function" && e.name === "approve")!;
    const isTransferSelector = policy.selector === toFunctionSelector(transferAbi);
    const isApproveSelector = policy.selector === toFunctionSelector(approveAbi);
    if (!isTransferSelector && !isApproveSelector) continue;

    const amountConstraints = policy.constraints.filter((constraint) => {
      const functionAbi = isTransferSelector ? transferAbi : approveAbi;
      if (constraint.index === BigInt(functionAbi.inputs.findIndex((e) => e.name === "amount"))) return true;
    });
    if (!amountConstraints.length) {
      addLimit(policy.target, LimitUnlimited);
      continue;
    }

    // The goal is to find max amount that could be spent within that call policy
    // To find max amount, we need to find the minimum of all constraints, since all of them should be satisfied
    const maxAmount: bigint | "unlimited" = amountConstraints.reduce((acc, constraint) => {
      switch (constraint.limit.limitType) {
        case LimitType.Unlimited: {
          if (acc === "unlimited") return "unlimited";
          return acc;
        }
        case LimitType.Allowance: {
          const periodLimit = calculateMaxPeriodSpend({
            sessionStartsAt: now.value,
            sessionExpiresAt: props.session.expiresAt,
            limitPerPeriod: constraint.limit.limit,
            period: constraint.limit.period,
          });

          if (acc === "unlimited") return periodLimit;
          if (acc < periodLimit) return acc;
          return periodLimit;
        }
        case LimitType.Lifetime: {
          const lifetimeLimit = constraint.limit.limit;

          if (acc === "unlimited") return lifetimeLimit;
          if (acc < lifetimeLimit) return acc;
          return lifetimeLimit;
        }
      }
    }, "unlimited" as bigint | "unlimited");

    if (maxAmount === "unlimited") {
      addLimit(policy.target, LimitUnlimited);
    } else {
      addLifetimeLimit(policy.target, maxAmount);
    }
  }

  return limits;
});

const spendLimitTokens = computed(() => {
  return Object.entries(limitsByToken.value)
    .filter(([, amount]) => amount !== 0n)
    .map(([tokenAddress, amount]) => {
      const token = tokensList.value?.find((token) => token.address === tokenAddress);
      if (!token) return null;
      return {
        token,
        amount,
      };
    })
    .filter((e) => !!e);
});

const hasUnlimitedSpend = computed(() => spendLimitTokens.value.some((item) => item.amount === "unlimited"));

const totalUsd = computed(() => (spendLimitTokens.value || []).reduce((acc, item) => {
  if (!item.token.price) return acc;
  const formattedTokenAmount = formatUnits(BigInt(item.amount), item.token.decimals);
  return acc + (parseFloat(formattedTokenAmount) * item.token.price);
}, 0));

fetchTokens();
</script>
