import { connect, createConfig, type CreateConnectorFn, disconnect, getAccount, http, reconnect, watchAccount } from "@wagmi/core";
import { type Address, parseEther, toFunctionSelector } from "viem";
import { zksyncInMemoryNode } from "viem/zksync";
import { zksyncAccountConnector } from "zksync-account/connector";
import { getSession } from "zksync-account/utils";

export const supportedChains = [zksyncInMemoryNode] as const;
export type SupportedChainId = (typeof supportedChains)[number]["id"];

export const useConnectorStore = defineStore("connector", () => {
  const runtimeConfig = useRuntimeConfig();

  const connector = zksyncAccountConnector({
    metadata: {
      name: "ZK NFT Quest",
      icon: "http://localhost:3006/favicon.svg",
    },
    gatewayUrl: "http://localhost:3002/confirm",
    session: getSession({
      feeLimit: { limit: parseEther("0.001") },
      callPolicies: [{
        target: runtimeConfig.public.contracts.nft,
        selector: toFunctionSelector("mint(address)"),
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

  // const getPublicClient = ({ chainId }: { chainId: SupportedChainId }) => {
  //   // const chain = supportedChains.find((c) => c.id === chainId);
  //   if (!chain) throw new Error(`Chain with id ${chainId} not found`);
  //   return createPublicClient({
  //     chain,
  //     transport: http(),
  //   });
  // };

  return {
    wagmiConfig: computed(() => wagmiConfig),
    account: computed(() => account.value),
    isConnected,
    connectAccount,
    disconnectAccount,
    address$,
    shortAddress,
    // getPublicClient,
  };
});
