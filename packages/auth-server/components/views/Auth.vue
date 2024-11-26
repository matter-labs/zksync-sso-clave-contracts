<template>
  <div class="h-full flex flex-col justify-center px-4">
    <SessionMetadata
      :app-meta="appMeta"
      :connect="true"
      class="grow flex justify-center items-center flex-col"
    />

    <CommonHeightTransition :opened="!!accountLoginError">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span>
          Account not found.
          <button
            type="button"
            class="underline underline-offset-4"
            @click="registerAccount"
          >
            Sign up?
          </button>
        </span>
      </p>
    </CommonHeightTransition>

    <CommonHeightTransition :opened="!!createAccountError">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span>
          Creating account failed.
        </span>
      </p>
    </CommonHeightTransition>

    <div class="flex flex-col gap-5 mt-8 py-8 w-[300px] m-auto">
      <ZkHighlightWrapper>
        <ZkButton
          class="w-full"
          :loading="registerInProgress"
          data-testid="signup"
          @click="registerAccount"
        >
          Sign Up
        </ZkButton>
      </ZkHighlightWrapper>

      <ZkButton
        type="secondary"
        class="!text-slate-400"
        :loading="loginInProgress"
        data-testid="login"
        @click="loginAccount"
      >
        Log In
      </ZkButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { appMeta } = useAppMeta();
const { requestChain, requestMethod } = storeToRefs(useRequestsStore());
const session = useAppSession();

const { registerInProgress, createAccount, createAccountError } = useAccountCreate(computed(() => requestChain.value!.id));
const { loginInProgress, accountLoginError, loginToAccount } = useAccountLogin(computed(() => requestChain.value!.id));

const registerAccount = async () => {
  if (!session.value) {
    // no session defined
    await createAccount();
    if (!createAccountError) {
      navigateTo("/confirm/connect");
    }
  } else {
    navigateTo({ path: "/confirm/connect", query: { action: "register" } });
  }
};

const loginAccount = async () => {
  await loginToAccount();
  // TODO: if app provides a session, check if session for user is active.
  // if active, close the popup and log user in
  // if not active, navigate to connect session page

  // if app does not have sessions, navigate to /confirm/connect page
  // and display request accounts view

  if (requestMethod.value === "eth_requestAccounts") {
    navigateTo("/confirm/connect");
  }
};
</script>
