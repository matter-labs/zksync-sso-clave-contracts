<template>
  <TokenLine
    :symbol="symbol"
    :name="name"
    :address="address"
    :decimals="decimals"
    :icon-url="iconUrl"
    :as="sendRouteName ? 'RouterLink' : as"
    :to="sendRouteName ? { name: sendRouteName, query: { token: address } } : undefined"
    class="token-balance"
    :class="{ 'is-zero-amount': isZeroAmount }"
  >
    <template #right>
      <CommonButtonLineBodyInfo class="text-right">
        <template #secondary>
          <div
            class="token-balance-amount"
            :title="unformattedAmount"
          >
            {{ formattedAmount }}
          </div>
        </template>
        <template #underline>
          <div class="token-balance-price">
            <template v-if="!isZeroAmount && tokenPrice">
              {{ tokenPrice }}
            </template>
          </div>
        </template>
      </CommonButtonLineBodyInfo>
    </template>
  </TokenLine>
</template>

<script lang="ts" setup>
import { formatUnits } from "viem";

const props = defineProps({
  as: {
    type: [String, Object] as PropType<string | Component>,
  },
  symbol: {
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  address: {
    type: String,
    required: true,
  },
  decimals: {
    type: Number,
    required: true,
  },
  iconUrl: {
    type: String,
  },
  amount: {
    type: String as PropType<string | "unlimited">,
    required: true,
  },
  price: {
    type: [String, Number] as PropType<number | undefined>,
  },
  sendRouteName: {
    type: String,
  },
});

const isZeroAmount = computed(() => !props.amount);
const isUnlimitedAmount = computed(() => props.amount === "unlimited");
const unformattedAmount = computed(() => {
  if (isUnlimitedAmount.value) return undefined;
  return formatUnits(BigInt(props.amount), props.decimals);
});
const formattedAmount = computed(() => {
  if (isUnlimitedAmount.value) return "Unlimited";
  return formatAmount(BigInt(props.amount), props.decimals);
});
const tokenPrice = computed(() => {
  if (!props.price || isUnlimitedAmount.value) return;
  return formatTokenPrice(BigInt(props.amount), props.decimals, props.price);
});
</script>

<style lang="scss" scoped>
.token-balance {
  &.is-zero-amount {
    .token-balance-amount {
      @apply opacity-30;
    }
  }
  .token-balance-amount {
    @apply max-w-[100px] truncate;
  }
}
</style>
