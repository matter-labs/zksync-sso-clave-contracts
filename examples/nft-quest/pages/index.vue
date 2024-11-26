<template>
  <div class="grow flex flex-col sm:flex-row relative">
    <div class="order-last sm:order-first border-b border-b-neutral-900 sm:border-b-0 sm:border-r sm:border-r-neutral-900 basis-6/12 h-full">
      <div class="h-full flex flex-col p-4 justify-center">
        <div>
          <BlurFade
            in-view
            :delay="0"
            class="block sm:inline text-center sm:text-pretty"
          >
            <span class="text-[40px] font-bold tracking-tighter dark:text-white leading-1 text-center">
              Smart wallets on the Elastic Chain.
            </span>
          </BlurFade>

          <div class="sm:inline text-center sm:text-pretty">
            <BlurFade
              in-view
              :delay="550"
              class="inline text-center sm:text-pretty"
            >
              <span class="text-[40px] font-bold tracking-tighter leading-1 text-blue-400">
                Click.
              </span>
            </BlurFade>
            <BlurFade
              in-view
              :delay="1050"
              class="inline text-center sm:text-pretty"
            >
              <span class="text-[40px] font-bold tracking-tighter leading-1 text-blue-700">
                Connect.
              </span>
            </BlurFade>
          </div>
        </div>
        <BlurFade
          in-view
          :delay="50"
          class="flex flex-col sm:inline items-center"
        >
          <p class=" mt-8 text-neutral-400 max-w-prose">
            ZKsync makes any crypto transaction simple using familiar sign-on methods like passkeys and lets you set custom parameters like time and spending limits. No more mnemonic phrases or annoying signature requests. Give it a try.
          </p>

          <div class="sticky bottom-[-8px] pb-4 bg-gradient-to-t from-black to-transparent w-full flex justify-center sm:justify-start">
            <ZkButton
              type="primary"
              class="uppercase mt-8 min-w-[240px]"
              @click="connect"
            >
              Let's Go
            </ZkButton>
          </div>
        </BlurFade>
      </div>
    </div>
    <div class="basis-6/12 flex items-center justify-center">
      <div class="nft-image aspect-square w-full sm:max-w-[680px] max-w-[75%]">
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
</template>

<script setup lang="ts">
const { isConnected } = storeToRefs(useConnectorStore());
const { connectAccount } = useConnectorStore();

const connect = async () => {
  if (isConnected.value) {
    navigateTo("/mint");
  } else {
    await connectAccount();
    navigateTo("/mint");
  }
};
</script>
