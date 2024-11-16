<template>
  <ZkButton
    type="primary"
    class="w-52"
    :ui="{base: 'py-0'}"
    :disabled="isLoading"
    @click="onClickAddCrypto"
  >
    <span v-if="!isLoading">Add Crypto account</span>
    <CommonSpinner v-else class="h-6"/>
  </ZkButton>
</template>

<script setup lang="ts">
import { createWalletClient, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployAccount } from "zksync-sso/client";
import { registerNewPasskey } from "zksync-sso/client/passkey";

const { appMeta, userDisplay, userId, contracts, deployerKey } = useAppMeta();
const isLoading = ref(false);

// Convert Uin8Array to string
const u8ToString = (input: Uint8Array): string => {
  const str = JSON.stringify(Array.from ? Array.from(input) : [].map.call(input, (v => v)));
  return str;
};

const onClickAddCrypto = async () => {
  isLoading.value = true;
  await createCryptoAccount();
  isLoading.value = false;
};

const createCryptoAccount = async () => {
  let credentialPublicKey: Uint8Array;

  // Create new Passkey
  if (!appMeta.value || !appMeta.value.credentialPublicKey) {
    try {
      const { credentialPublicKey: newCredentialPublicKey } = await registerNewPasskey({
        userDisplayName: userDisplay, // Display name of the user
        userName: userId, // User's unique ID
      });
      appMeta.value = {
        ...appMeta.value,
        credentialPublicKey: u8ToString(newCredentialPublicKey),
      };
      credentialPublicKey = newCredentialPublicKey;
    } catch (error) {
      console.error("Passkey registration failed:", error);
      return;
    }
  } else {
    credentialPublicKey = new Uint8Array(JSON.parse(appMeta.value.credentialPublicKey));
  }

  // Configure deployer account to pay for Account creation
  const config = useRuntimeConfig();
  const deployerClient = createWalletClient({
    account: privateKeyToAccount(deployerKey as Address),
    chain: config.public.network as Chain,
    transport: http()
  });

  try {
    const { address, transactionReceipt } = await deployAccount(deployerClient, {
      credentialPublicKey,
      contracts,
    });

    appMeta.value = {
      ...appMeta.value,
      cryptoAccountAddress: address,
    };
    console.log(`Successfully created account: ${address}`);
    console.log(`Transaction receipt: ${transactionReceipt.transactionHash}`);
  } catch (error) {
    console.error(error);
    return;
  }

  navigateTo("/crypto-account");
};
</script>
