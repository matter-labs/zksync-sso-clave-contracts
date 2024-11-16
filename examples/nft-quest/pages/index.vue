<template>
  <div class="h-full flex flex-col p-4 justify-center">
    <div>
      <BlurFade
        in-view
        :delay="0"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter dark:text-white leading-1">
          Smart wallets on the Elastic Chain.
        </span>
      </BlurFade>

      <BlurFade
        in-view
        :delay="550"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter leading-1 text-blue-400">
          Click.
        </span>
      </BlurFade>
      <BlurFade
        in-view
        :delay="950"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter leading-1 text-blue-700">
          Connect.
        </span>
      </BlurFade>
    </div>
    <BlurFade
      in-view
      :delay="1450"
      class="inline"
    >
      <p class=" mt-8 text-neutral-400 max-w-prose">
        ZKsync makes any crypto transaction simple using familiar sign-on methods like passkeys and lets you set custom parameters like time and spending limits. No more mnemonic phrases or annoying signature requests. Give it a try.
      </p>

      <ZkButton
        type="primary"
        class="uppercase mt-8"
        @click="connect"
      >
        Let's Go
      </ZkButton>
    </BlurFade>
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
