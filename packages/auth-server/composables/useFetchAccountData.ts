import { watchThrottled } from "@vueuse/core";
import type { Address } from "viem";

type AccountData = {
  username: string;
  address: Address;
  passkeyPublicKeys: Array<number>[];
  chainId: number;
};

export const useFetchAccountData = (_username: MaybeRef<string>, _chainId: MaybeRef<SupportedChainId>) => {
  const username = toRef(_username);
  const chainId = toRef(_chainId);
  const accountData = ref<AccountData | null>(null);
  /* const { getPublicClient } = useClientStore(); */

  const fetchAccountDataByUsername = async (name: string): Promise<AccountData | null> => {
    const factoryAddress = contractsByChain[chainId.value].accountFactory;
    if (!factoryAddress) throw new Error("Account factory address is not set");

    /* TODO: implement account info fetching */
    /* const publicClient = getPublicClient({ chainId: chainId.value });
    const data = publicClient.readContract({
      address: factoryAddress,
      functionName: "getAccountData",
      args: [name],
    }); */

    /* Temporary test code */
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (name === "test") {
      return await Promise.resolve({
        username: name,
        address: "0xa1cf087DB965Ab02Fb3CFaCe1f5c63935815f044",
        passkeyPublicKeys: [],
        chainId: chainId.value,
      });
    }
    return null;
  };

  const {
    inProgress: accountDataFetchInProgress,
    error: accountDataFetchError,
    execute: fetchAccountData,
  } = useAsync(async () => {
    const usernameToFetch = username.value;
    if (username.value === "error") {
      throw new Error("Testing error. Use a different username.");
    }
    if (usernameToFetch === accountData.value?.username) return;
    try {
      const data = await fetchAccountDataByUsername(usernameToFetch);
      if (username.value === usernameToFetch) {
        accountData.value = data;
      }
    } catch (error) {
      if (username.value === usernameToFetch) {
        throw error;
      }
    }
  });

  watchThrottled(username, (val) => {
    accountData.value = null;
    if (val) {
      fetchAccountData();
    }
  }, { throttle: 500 });

  return {
    accountData,
    accountDataFetchInProgress,
    accountDataFetchError,
    fetchAccountData,
  };
};
