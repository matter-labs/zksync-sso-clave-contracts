import { toHex } from "viem";
import { fetchAccount } from "zksync-sso/client";

export const useAccountLogin = (_chainId: MaybeRef<SupportedChainId>) => {
  const chainId = toRef(_chainId);
  const { login } = useAccountStore();
  const { getPublicClient } = useClientStore();

  const { inProgress: loginInProgress, error: accountLoginError, execute: loginToAccount } = useAsync(async () => {
    const client = getPublicClient({ chainId: chainId.value });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { username, address, passkeyPublicKey } = await fetchAccount(client as any, {
      contracts: contractsByChain[chainId.value],
    });

    login({
      username,
      address,
      passkey: toHex(passkeyPublicKey),
    });
  });

  return {
    loginInProgress,
    accountLoginError,
    loginToAccount,
  };
};
