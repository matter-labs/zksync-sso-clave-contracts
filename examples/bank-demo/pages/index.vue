<template>
  <div class="pb-24">
    <LayoutHeader>
      Home
    </LayoutHeader>
    <div class="flex gap-4 mb-4">
      <AppNavButton href="/">Accounts</AppNavButton>
      <AppNavButton href="/cards">Cards</AppNavButton>
      <AppNavButton v-if="appMeta.cryptoAccountAddress" href="/crypto-account">Crypto Account</AppNavButton>
      <AppAddCryptoButton v-else/>
    </div>

    <LayoutCard class="mb-8">
      <div class="flex">
        <div class="grow mb-4">
          <p v-if="!appMeta.hasCompletedInitialTransfer" class="text-4xl font-bold">£ 2,000</p>
          <p v-else class="text-4xl font-bold">£{{(history.mainAccount.reduce((acc, cv) => acc + cv.value, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</p>
          <p class="text-lg font-medium text-neutral-400">British Pound</p>
        </div>
        <div>
          <TokenGbp :height="48"/>
        </div>
      </div>
      <div class="flex gap-2 text-xs sm:text-base">

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="add" />
          </template>
          Add money
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="arrow_forward" />
          </template>
          Send
        </ZkButton>

        <ZkButton type="secondary">
          <template #prefix>
            <ZkIcon icon="info" />
          </template>
          Account details
        </ZkButton>


        <ZkDropdown :hide-toggle="true" :menu="dropdownMenu" align="end" type="secondary" @select="itemSelected">
          <ZkIcon icon="more_horiz" ui="px-2"/>
        </ZkDropdown>
      </div>

      <p class="mt-6 text-neutral-500">Transactions</p>
      <div v-for="(item, index) in history.mainAccount" :key="index" class="flex gap-2 mt-6">
        <ZkIconThumbnail :icon="item.icon" />
        <div class="grow">
          <p>{{ item.description }}</p>
          <p class="text-sm text-neutral-600">{{ item.time }}</p>
        </div>
        <div class="text-2xl font-light">
          {{item.amount}}
        </div>
      </div>
    </LayoutCard>
  </div>
</template>

<script setup lang="ts">
const { appMeta } = useAppMeta();
const history = useHistory();

const dropdownMenu = [
  {
    value: "reset",
    label: "Reset Demo",
  }
];

const itemSelected = (value: string) => {
  if (value === "reset") {
    localStorage.clear();
    window.location.reload();
  }
};
</script>
