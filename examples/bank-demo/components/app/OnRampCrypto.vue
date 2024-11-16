<template>
  <div class="bg-primary-400 rounded-t-zk flex items-center justify-center gap-2 py-4">
    <span class="text-white text-2xl">Buy</span>
  </div>

  <LayoutCard class="mb-8 rounded-t-none">
    <div class="flex gap-2 mb-12">
      <TokenEth :height="3"/>
      <div class="grow flex justify-stretch">
        <div class="grow">
          <div>ETH</div>
          <div class="text-sm text-neutral-600">ZKsync</div>
        </div>
      </div>
      <div class="flex gap-2">
        <ZkButtonIcon type="ghost" icon="keyboard_arrow_down"/>
      </div>
    </div>

    <div v-if="!transferEthAsCurrency">
      <div class="flex justify-center items-center">
        <div class="mb-4 flex flex-col justify-center items-center">
          <div class="flex flex-row items-center">
            <p class="text-4xl font-bold">£{{transferAmount.toLocaleString()}}</p>
            <ZkButtonIcon type="secondary" icon="swap_vert" class="h-8 w-8 ml-2" @click="swapTransferCurrency"/>
          </div>
          <p class="text-sm font-medium text-neutral-400">{{(transferAmount / cart.priceOfEth).toFixed(4)}} ETH</p>
        </div>
      </div>

      <div class="flex gap-2 justify-center mt-8">
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 10">£10</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 100">£100</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 500">£500</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 1000">£1,000</ZkButton>
      </div>
    </div>
    <div v-else>
      <div class="flex justify-center items-center">
        <div class="mb-4 flex flex-col justify-center items-center">
          <div class="flex flex-row items-center">
            <p class="text-4xl font-bold">{{transferAmount}} ETH</p>
            <ZkButtonIcon type="secondary" icon="swap_vert" class="h-8 w-8 ml-2" @click="swapTransferCurrency"/>
          </div>
          <p class="text-sm font-medium text-neutral-400">£{{(transferAmount * cart.priceOfEth).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}}</p>
        </div>
      </div>

      <div class="flex gap-2 justify-center mt-8">
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 0.01">0.01 ETH</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 0.1">0.1 ETH</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 0.5">0.5 ETH</ZkButton>
        <ZkButton type="secondary" class="h-8" @click="transferAmount = 1">1 ETH</ZkButton>
      </div>
    </div>
  </LayoutCard>

  <LayoutCard class="mb-8 py-4 px-4">
    <div class="flex gap-2 items-center">
      <ZkIcon icon="credit_card" />
      <div class="grow flex justify-stretch">
        <div class="grow">
          <div class="font-bold">Pay with</div>
          <div class="text-sm text-neutral-600">Main account</div>
        </div>
      </div>
      <div class="flex gap-2">
        <ZkButtonIcon type="ghost" icon="keyboard_arrow_right" class=""/>
      </div>
    </div>
  </LayoutCard>

  <div class="flex justify-center">
    <ZkButton type="primary" class="w-96 py-2 text-xl" @click="continueToTransferConfirmation">Continue</ZkButton>
  </div>
</template>

<script setup lang="ts">
const transferAmount = ref(10);
const transferEthAsCurrency = ref(false);
const cart = useCart();

const swapTransferCurrency = () => {
  transferEthAsCurrency.value = !transferEthAsCurrency.value;
  if (transferEthAsCurrency.value) {
    transferAmount.value = +(transferAmount.value / cart.value.priceOfEth).toFixed(4);
  } else {
    transferAmount.value = +(transferAmount.value * cart.value.priceOfEth).toFixed(2);
  }
};

const continueToTransferConfirmation = async () => {
  if (transferEthAsCurrency.value) {
    cart.value.amount = +(transferAmount.value * cart.value.priceOfEth).toFixed(2);
  } else {
    cart.value.amount = transferAmount.value;
  }
  navigateTo("/checkout");
};
</script>
