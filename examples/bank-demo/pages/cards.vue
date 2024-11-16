<template>
  <div class="pb-24">
    <LayoutHeader>
      Home
    </LayoutHeader>
    <div class="flex gap-4 mb-4 text-xs sm:text-base">
      <AppNavButton href="/">Accounts</AppNavButton>
      <AppNavButton href="/cards">Cards</AppNavButton>
      <AppNavButton v-if="appMeta.cryptoAccountAddress" href="/crypto-account">Crypto Account</AppNavButton>
      <AddCryptoButton v-else/>
    </div>

    <LayoutCard class="mb-8">
      <div class="flex">
        <div class="grow">
          <p class="text-2xl font-medium text-neutral-400">None</p>
        </div>
        <div>
          <ZkIcon icon="credit_card" class="text-neutral-400" />
        </div>
      </div>
    </LayoutCard>

  </div>
</template>

<script setup lang="ts">
import AddCryptoButton from "~/components/app/AddCryptoButton.vue";

const { appMeta } = useAppMeta();
</script>
