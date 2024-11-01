<template>
  <div class="h-dvh flex flex-col">
    <div class="flex border-b border-b-neutral-900">
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
    <div class="grow flex flex-col sm:flex-row">
      <div class="order-last sm:order-first border-b border-b-neutral-900 sm:border-b-0 sm:border-r sm:border-r-neutral-900 basis-6/12 h-full">
        <NuxtPage />
      </div>
      <div class="basis-6/12 flex items-center justify-center">
        <div class="nft-image max-w-[680px]">
          <video
            autoplay
            loop
            muted
          >
            <source
              src="/nft/zeek-nft.mp4"
              type="video/mp4"
            >
          </video>
        </div>
      </div>
    </div>
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

.nft-image {
  background-image: url('/nft-animation.png');

}
</style>
