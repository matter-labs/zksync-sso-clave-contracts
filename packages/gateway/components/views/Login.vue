<template>
  <div class="h-full flex flex-col justify-center pb-8">
    <div class="mx-auto mt-6 w-20 h-20 rounded-full bg-neutral-800">
      <img
        v-if="appMeta.icon"
        :src="appMeta.icon"
        :alt="appMeta.name"
        class="h-full w-full object-cover rounded-full"
      >
    </div>
    <h1 class="text-white text-center text-2xl mt-4 font-semibold">
      Connect to {{ appMeta.name }}
    </h1>

    <div
      v-if="screen === 'choose-auth-method'"
      class="form-content"
    >
      <CommonButton
        class="w-full"
        @click="screen = 'register'"
      >
        Create account
      </CommonButton>
      <CommonButton
        class="w-full"
        variant="neutral"
        @click="screen = 'login'"
      >
        I already have account
      </CommonButton>
    </div>
    <form
      v-else-if="screen === 'register' || screen === 'login'"
      class="form-content"
      @submit.prevent="onFormSubmit()"
    >
      <div>
        <CommonInput
          v-model="username"
          placeholder="Username"
          required
          minlength="3"
          maxlength="32"
          autofocus
          :loading="accountDataFetchInProgress"
          :disabled="registerInProgress || loginInProgress"
        />
        <CommonHeightTransition :opened="!!accountDataFetchError || !!errorState || !!passkeyError">
          <p class="pt-3 text-sm text-error-300 text-center">
            <span
              v-if="accountDataFetchError"
            >
              {{ accountDataFetchError }}
            </span>
            <span v-else-if="errorState === 'username-taken'">
              Username is already taken.
              <button
                type="button"
                class="underline underline-offset-4"
                @click="screen = 'login'"
              >
                Login instead?
              </button>
            </span>
            <span v-else-if="errorState === 'account-not-found'">
              Account not found.
              <button
                type="button"
                class="underline underline-offset-4"
                @click="screen = 'register'"
              >
                Create account?
              </button>
            </span>
            <span v-else-if="passkeyError">
              {{ passkeyError }}
            </span>
          </p>
        </CommonHeightTransition>
      </div>
      <CommonButton
        class="w-full"
        :loading="registerInProgress"
        type="submit"
      >
        {{ mainButton }}
      </CommonButton>
      <div
        v-if="secondaryButton"
        class="prevent-content-shift"
      >
        <CommonButton
          variant="transparent"
          type="button"
          size="sm"
          class="w-full"
          @click="secondaryButton.onClick()"
        >
          {{ secondaryButton?.label }}
        </CommonButton>
      </div>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { parseEther, toHex } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { deployAccount, registerNewPasskey } from "zksync-account/client/actions";

const { appMeta } = useAppMeta();
const { login } = useAccountStore();
const { getRichWalletClient } = useClientStore();
const { requestChain } = storeToRefs(useRequestsStore());

const screen = ref<"choose-auth-method" | "register" | "login">("choose-auth-method");
const username = ref("");

const { accountData, accountDataFetchInProgress, accountDataFetchError/* , fetchAccountData */ } = useFetchAccountData(
  username,
  computed(() => requestChain.value!.id),
);

const passkeyError = ref<string | undefined>(undefined);
const errorState = computed<"username-taken" | "account-not-found" | undefined>(() => {
  if (screen.value === "register") {
    if (accountData.value) {
      return "username-taken";
    }
  } else if (screen.value === "login") {
    if (username.value && !accountDataFetchInProgress.value && !accountData.value) {
      return "account-not-found";
    }
  }
  return undefined;
});
const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
  const { credentialPublicKey } = await registerNewPasskey({
    userName: username.value,
    userDisplayName: username.value,
  });

  /* TODO: implement username check */
  /* await fetchAccountData();
  if (accountData.value) {
    return; // username is taken
  } */

  const deployerClient = getRichWalletClient({ chainId: requestChain.value!.id });
  const sessionKey = generatePrivateKey();
  const sessionPublicKey = privateKeyToAddress(sessionKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { address } = await deployAccount(deployerClient as any, {
    credentialPublicKey,
    /* TODO: Remove spend limit, right now deployment fails without initial data */
    initialSpendLimit: [
      {
        sessionPublicKey,
        token: "0x111C3E89Ce80e62EE88318C2804920D4c96f92bb",
        amount: BigInt(100),
      },
    ],
    contracts: contractsByChain[requestChain.value!.id],
  });
  await deployerClient.sendTransaction({
    to: address,
    value: parseEther("1"),
  });
  login({
    username: username.value,
    address: address,
    passkey: toHex(credentialPublicKey),
    sessionKey,
  });
});
const { inProgress: loginInProgress, execute: connectToAccount } = useAsync(async () => {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      userVerification: "discouraged",
    },
  });
  if (!credential) throw new Error("No registered passkeys");

  // eslint-disable-next-line no-console
  console.log({ credential });
  // eslint-disable-next-line no-console
  console.log("Login not implemented yet");
  /* TODO: find account by credential.id */
});

const mainButton = computed(() => {
  if (screen.value === "register") {
    return "Create account";
  } else if (screen.value === "login") {
    return "Login";
  }
  return undefined;
});
const secondaryButton = computed(() => {
  if (screen.value === "register") {
    return {
      label: "Go to login",
      onClick: () => {
        screen.value = "login";
      },
    };
  } else if (screen.value === "login") {
    return {
      label: "Go to register",
      onClick: () => {
        screen.value = "register";
      },
    };
  }
  return undefined;
});
const onFormSubmit = async () => {
  if (screen.value === "register") {
    await createAccount();
  } else if (screen.value === "login") {
    await connectToAccount();
  }
};
</script>

<style lang="scss" scoped>
.form-content {
  @apply flex flex-col gap-4 mt-8;

  .prevent-content-shift {
    @apply h-0 -mb-4;
  }
}
</style>
