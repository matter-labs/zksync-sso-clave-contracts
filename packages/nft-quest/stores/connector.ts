import { connect, createConfig, type CreateConnectorFn, disconnect, getAccount, http, reconnect, watchAccount } from "@wagmi/core";
import { type Address, type Hash, parseEther } from "viem";
import { zksyncInMemoryNode, zksyncLocalNode, zksyncSepoliaTestnet } from "viem/chains";
import { zksyncAccountConnector } from "zksync-sso/connector";
import { getSession } from "zksync-sso/utils";

export const useConnectorStore = defineStore("connector", () => {
  const runtimeConfig = useRuntimeConfig();
  const supportedChains = [
    zksyncSepoliaTestnet,
    zksyncInMemoryNode,
    zksyncLocalNode,
  ].filter((x) => x.id == runtimeConfig.public.chain.id);
  type SupportedChainId = (typeof supportedChains)[number]["id"];

  const connector = zksyncAccountConnector({
    metadata: {
      name: "ZK NFT Quest",
      icon: `${runtimeConfig.public.baseUrl}/favicon.svg`,
    },
    authServerUrl: runtimeConfig.public.authServerUrl,
    session: getSession({
      feeLimit: parseEther("0.1"),
      callPolicies: [{
        target: runtimeConfig.public.contracts.nft as Hash,
        function: "mint(address)",
      }],
    }),
  });
  const wagmiConfig = createConfig({
    chains: supportedChains,
    connectors: [connector as CreateConnectorFn],
    transports: (Object.fromEntries(supportedChains.map((chain) => [chain.id, http()]))) as Record<SupportedChainId, ReturnType<typeof http>>,
  });

  const account = ref(getAccount(wagmiConfig));
  const isConnected = computed(() => account.value.isConnected);
  const address = computed(() => account.value.address);
  reconnect(wagmiConfig);

  watchAccount(wagmiConfig, {
    onChange: async (updatedAccount) => {
      account.value = updatedAccount;
    },
  });

  const connectAccount = async () => {
    return await connect(wagmiConfig, {
      connector,
      chainId: supportedChains[0].id,
    });
  };

  const disconnectAccount = () => {
    disconnect(wagmiConfig);
  };

  const shortAddress = computed(() => {
    if (!address.value) return null;
    return useTruncateAddress(address.value);
  });

  const { subscribe: address$, notify: notifyOnAccountChange } = useObservable<Address | undefined>();
  watch(address, (newAddress) => {
    notifyOnAccountChange(newAddress);
  });

  return {
    wagmiConfig: computed(() => wagmiConfig),
    account: computed(() => account.value),
    isConnected,
    connectAccount,
    disconnectAccount,
    address$,
    shortAddress,
  };
});
