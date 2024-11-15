<template>
  <main class="h-full flex flex-col justify-center px-4">
    <AppAccountLogo
      class="dark:text-neutral-100 h-16 md:h-20 mb-8"
    />

    <div class="flex flex-col gap-5 mt-8 py-8">
      <ZkHighlightWrapper>
        <ZkButton
          class="w-full"
          :loading="registerInProgress"
          data-testid="signup"
          @click="signUp"
        >
          Sign Up
        </ZkButton>
      </ZkHighlightWrapper>

      <ZkButton
        type="secondary"
        class="!text-slate-400"
        :loading="loginInProgress"
        data-testid="login"
        @click="logIn"
      >
        Log In
      </ZkButton>
    </div>

    <CommonHeightTransition :opened="!!accountLoginError">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span>
          Account not found.
          <button
            type="button"
            class="underline underline-offset-4"
            @click="signUp"
          >
            Sign up?
          </button>
        </span>
      </p>
    </CommonHeightTransition>
  </main>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ["logged-out"],
});

const runtimeConfig = useRuntimeConfig();

const chainId = runtimeConfig.public.chainId as SupportedChainId;

const { registerInProgress, createAccount } = useAccountCreate(chainId);
const { loginInProgress, accountLoginError, loginToAccount } = useAccountLogin(chainId);

const signUp = async () => {
  await createAccount();
  navigateTo("/dashboard");
};
const logIn = async () => {
  await loginToAccount();
  navigateTo("/dashboard");
};
</script>
