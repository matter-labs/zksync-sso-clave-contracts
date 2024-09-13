import { http, createPublicClient } from "viem";
import { zksync, zksyncSepoliaTestnet, zksyncInMemoryNode } from "viem/chains";
import { createZksyncWalletClient, type ZksyncAccountContracts } from "zksync-account/client";

export const supportedChains = [zksync, zksyncSepoliaTestnet, zksyncInMemoryNode];
export type SupportedChainId = (typeof supportedChains)[number]["id"];
export const blockExplorerApiByChain: Record<SupportedChainId, string> = {
  [zksync.id]: zksync.blockExplorers.native.apiUrl,
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
  [zksyncInMemoryNode.id]: "http://localhost:3020",
};
export const contractsByChain: Record<SupportedChainId, ZksyncAccountContracts> = {
  [zksync.id]: {
    session: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
    accountFactory: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
  },
  [zksyncSepoliaTestnet.id]: {
    session: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
    accountFactory: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
  },
  [zksyncInMemoryNode.id]: {
    session: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
    accountFactory: "0xa00e749EAC6d9C1b78b916ab69f2B7E5990Eea77",
  },
};

export const useClientStore = defineStore("client", () => {
  /* const { subscribeOnAddressChange } = useAccountStore(); */
  const { address } = storeToRefs(useAccountStore());
  /* let client: ZksyncAccountWalletClient | undefined;

  const createClient = async ({ chainId }: { chainId: number }) => {
    if (!address.value) throw new Error("Address is not set");
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    client = createZksyncWalletClient({
      address: address.value,
      chain,
      contracts,
      sessionKey: undefined,
      transport: http(),
    });
  }; */

  const getPublicClient = ({ chainId }: { chainId: SupportedChainId }) => {
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    return client;
  };

  const getClient = ({ chainId }: { chainId: SupportedChainId }) => {
    if (!address.value) throw new Error("Address is not set");
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);
    const contracts = contractsByChain[chainId];

    /*
      TODO: remove any
      `any` are set due to using zksync-account via `npm link`
      which makes it use same packages from different folders
      types are too complex to compare so it fails
    */
    const client = createZksyncWalletClient({
      address: address.value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain: chain as any,
      contracts,
      sessionKey: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: http() as any,
    });

    return client;
  };

  /* subscribeOnAddressChange((newAddress) => {
    if (!newAddress) return;
    createClient();
  });
  if (address.value) createClient(); */

  return {
    getPublicClient,
    getClient,
  };
});
