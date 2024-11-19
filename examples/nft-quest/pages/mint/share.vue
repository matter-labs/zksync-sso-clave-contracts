<template>
  <div class="h-full flex items-center flex-col justify-center relative">
    <div class="p-4 grow h-full justify-center flex flex-col mb-8">
      <BlurFade
        in-view
        :delay="0"
        class="inline"
      >
        <img
          src="/check.gif"
          width="48"
        >
      </BlurFade>
      <BlurFade
        in-view
        :delay="0"
        class="inline"
      >
        <span class="text-[45px] font-bold tracking-tighter dark:text-white leading-1">
          You've got Zeek.
        </span>
      </BlurFade>
      <GradualSpacing
        v-if="showBanner"
        class="text-[45px] font-bold tracking-tighter leading-1 text-blue-600"
        text="SSO Simple."
        :delay-multiple="25"
      />
      <div
        v-else
        class="text-[45px] font-bold tracking-tighter leading-1 text-neutral-950"
      >
        <!-- To prevent the weird bump in spacing when the gradualSpacing runs. -->
        &nbsp;
      </div>
      <BlurFade
        in-view
        :delay="650"
        class="inline"
      >
        <div class="h-full">
          <p class=" mt-8 text-neutral-400 max-w-prose">
            Now share the Zeek. Wasn't that easy? Even I can do it. And I'm a cat.
          </p>
          <ZkLink
            :to="transactionURL"
            target="_blank"
            type="secondary"
            class="mt-8"
          >
            Transaction details
            <ZkIcon
              icon="open_in_new"
              class="ml-2"
            />
          </ZkLink>
          <p class="mt-4 text-xs text-neutral-500">
            The NFT you have minted is available on the testnet only; <br>
            it has no monetary value, and cannot be transferred to the mainnet.
          </p>

          <p class="mt-10 text-neutral-400">
            Your session is still active! You can mint another NFT and send it to your friend without having to approve any more transactions! Try it below!
          </p>
        </div>
      </BlurFade>
    </div>

    <div class="border-t border-t-neutral-900 w-full p-2">
      <TransferZeek />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [
    function (to) {
      if (to.query.tx === undefined) {
        return navigateTo("/mint");
      }
    },
  ],
});

const showBanner = ref(false);

setTimeout(() => {
  showBanner.value = true;
}, 750);

const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const transactionURL = computed(() => {
  return `${runtimeConfig.public.explorerUrl}/tx/${route.query.tx}`;
});
</script>
