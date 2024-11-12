import { toHex } from "viem";
import { deployAccount } from "zksync-sso/client";
import { registerNewPasskey } from "zksync-sso/client/passkey";

export const useAccountCreate = (_chainId: MaybeRef<SupportedChainId>) => {
  const chainId = toRef(_chainId);
  const { login } = useAccountStore();
  const { getThrowAwayClient } = useClientStore();

  const { inProgress: registerInProgress, execute: createAccount } = useAsync(async () => {
    // Format passkey display name similar to "ZKsync SSO 11/11/2024 01:46 PM"
    let name = `ZKsync SSO ${(new Date()).toLocaleDateString("en-US")}`;
    name += ` ${(new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    const {
      credentialPublicKey,
      credentialId,
    } = await registerNewPasskey({
      userName: name,
      userDisplayName: name,
    });

    const deployerClient = getThrowAwayClient({ chainId: chainId.value });

    const { address } = await deployAccount(deployerClient, {
      credentialPublicKey,
      uniqueAccountId: credentialId,
      contracts: contractsByChain[chainId.value],
      paymasterAddress: contractsByChain[chainId.value].accountPaymaster,
    });

    login({
      username: credentialId,
      address: address,
      passkey: toHex(credentialPublicKey),
    });
  });

  return {
    registerInProgress,
    createAccount,
  };
};
