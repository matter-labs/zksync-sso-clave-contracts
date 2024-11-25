<template>
  <div class="grow flex flex-col sm:flex-row">
    <div class="order-last sm:order-first border-b border-b-neutral-900 sm:border-b-0 sm:border-r sm:border-r-neutral-900 basis-6/12 h-full">
      <div class="h-full flex flex-col p-4 justify-center">
        <NuxtPage />
      </div>
    </div>
    <div class="basis-6/12 flex items-center justify-center">
      <div class="nft-image-gif aspect-square w-full sm:max-w-[680px] max-w-[75%]" />
    </div>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: "Mint",
  ogTitle: "Mint - NFT Quest",
});
</script>

<style lang="css">
.nft-image-gif {
  background-image: url("/nft-slow-loop.gif");
  background-size: contain;
}
</style>
