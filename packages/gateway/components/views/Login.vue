<template>
  <div class="h-full flex flex-col justify-center px-4">
    <div class="h-[40%] justify-center items-center flex flex-col">
      <div class="mx-auto mt-6 w-20 h-20 rounded-full bg-neutral-800">
        <img
          v-if="appMeta && appMeta.icon"
          :src="appMeta.icon"
          :alt="appMeta.name"
          class="h-full w-full object-cover rounded-full"
        >
      </div>
      <h1 class="text-white text-center text-2xl mt-4 font-semibold">
        Connect to {{ appMeta?.name }}
      </h1>
    </div>

    <div class="flex flex-col gap-5 mt-8 py-8">
      <div className="highlight">
        <div className="inner">
          <ZkButton
            id="create-account"
            class="w-full"
            :loading="registerInProgress"
            @click="createAccount"
          >
            Sign Up
          </ZkButton>
        </div>
      </div>

      <ZkButton
        id="login-account"
        type="secondary"
        class="!text-slate-400"
        :loading="loginInProgress"
        @click="connectToAccount"
      >
        Sign In
      </ZkButton>
    </div>

    <CommonHeightTransition :opened="!!accountDataFetchError">
      <p class="pt-3 text-sm text-error-300 text-center">
        <span>
          Account not found.
          <button
            type="button"
            class="underline underline-offset-4"
            @click="createAccount"
          >
            Sign up?
          </button>
        </span>
      </p>
    </CommonHeightTransition>
  </div>
</template>

<script lang="ts" setup>
import { parseEther, toHex } from "viem";
import { zksyncInMemoryNode, zksyncLocalNode } from "viem/chains";
import { deployAccount, fetchAccount } from "zksync-account/client";
import { registerNewPasskey } from "zksync-account/client/passkey";

const { appMeta } = useAppMeta();
const { login } = useAccountStore();
const { getRichWalletClient, getPublicClient } = useClientStore();
const { requestChain } = storeToRefs(useRequestsStore());

const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
  let name = `ZK Auth ${(new Date()).toLocaleDateString("en-US")}`;
  if (requestChain.value!.id == zksyncInMemoryNode.id || requestChain.value!.id == zksyncLocalNode.id) {
    // For local testing, append the time
    name += ` ${(new Date()).toLocaleTimeString("en-US")}`;
  }

  const {
    credentialPublicKey,
    credentialId,
  } = await registerNewPasskey({
    userName: name,
    userDisplayName: name,
  });

  const deployerClient = getRichWalletClient({ chainId: requestChain.value!.id });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { address } = await deployAccount(deployerClient as any, {
    credentialPublicKey,
    uniqueAccountId: credentialId,
    contracts: contractsByChain[requestChain.value!.id],
  });

  // TODO: Replace the cost of session key creation with a Paymaster
  await deployerClient.sendTransaction({
    to: address,
    value: parseEther("1"),
  });

  login({
    username: credentialId,
    address: address,
    passkey: toHex(credentialPublicKey),
  });
});

const { inProgress: loginInProgress, error: accountDataFetchError, execute: connectToAccount } = useAsync(async () => {
  const client = getPublicClient({ chainId: requestChain.value!.id });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { username, address, passkeyPublicKey } = await fetchAccount(client as any, {
    contracts: contractsByChain[requestChain.value!.id],
  });

  login({
    username,
    address,
    passkey: toHex(passkeyPublicKey),
  });
});
</script>

<style scoped>
.highlight::before,
.highlight::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(45deg, #ff595e, #ffca3a, #8ac926, #1982c4, #6a4c93, #ff6700);
  background-size: 400%;
  z-index: -1;
  animation: glow 5s linear infinite;
  width: 100%;
  border-radius: 2rem;
}

.highlight::after {
  filter: blur(9px);
  transform: translate3d(0, 0, 0); /* For Safari */
}

.highlight {
  position: relative;
  border-radius: 2rem;
  padding: 4px;
}

.highlight .inner {
  border-radius: 4px;
}

@keyframes glow {
  0% { background-position: 0 0; }
  50% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
</style>
