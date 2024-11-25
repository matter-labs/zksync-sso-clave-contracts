<template>
  <div class="h-dvh flex flex-col">
    <div class="flex border-b border-b-neutral-900 pr-2">
      <div class="grow">
        <NuxtLink
          to="/"
          class="inline-block"
        >
          <div class="logo">
            <img src="/logo-animated.gif">
          </div>
        </NuxtLink>
      </div>
      <WalletButton />
    </div>
    <NuxtPage />
  </div>
</template>

<script lang="ts" setup>
defineOgImageComponent("ZeekNFT");
</script>

<style lang="css">
.logo {
  background-image: url('/zksync-logo.svg');
  width: 201px;
  height: 66px;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.18s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>
