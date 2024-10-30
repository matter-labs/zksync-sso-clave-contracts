import { createPublicClient, createWalletClient, http, publicActions, walletActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zksyncInMemoryNode } from "viem/chains";
import { createZksyncEoaClient } from "zksync-account/client";
import { createZksyncPasskeyClient, type PasskeyRequiredContracts } from "zksync-account/client/passkey";

const interopChain1 = {
  ...zksyncInMemoryNode,
  id: 505,
  name: "InteropChain1",
  network: "interop-chain-1",
  rpcUrls: {
    default: {
      http: ["https://zksync-interop.com/chain-1"],
    },
  },
} as const;
/* const interopChain2 = {
  ...zksyncInMemoryNode,
  id: 271,
  name: "InteropChain2",
  network: "interop-chain-2",
  rpcUrls: {
    default: {
      http: ["http://34.133.217.222:3052"],
    },
  },
} as const; */

export const supportedChains = [interopChain1];
export type SupportedChainId = (typeof supportedChains)[number]["id"];
export const blockExplorerApiByChain: Record<SupportedChainId, string> = {
  [interopChain1.id]: "",
  /* [zksync.id]: zksync.blockExplorers.native.apiUrl,
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
  [zksyncInMemoryNode.id]: "http://localhost:8011", */
};

type ChainContracts = PasskeyRequiredContracts & {
  accountFactory: NonNullable<PasskeyRequiredContracts["accountFactory"]>;
  accountImplementation: NonNullable<PasskeyRequiredContracts["accountImplementation"]>;
};
export const contractsByChain: Record<SupportedChainId, ChainContracts> = {
  [interopChain1.id]: {
    session: "0xca051887c4a5f8c027F357e972CBe3BA01Af67A9",
    passkey: "0x82adC3316893a6B5eBC92aA05fd556ef450a78F0",
    accountFactory: "0xf2FcC18ED5072b48C0a076693eCa72fE840b3981",
    accountImplementation: "0xb998E46454f29d6D8641b0264c3c1b42837C7F52",
  },
};

export const useClientStore = defineStore("client", () => {
  const { address, username, passkey, temp_privateKey } = storeToRefs(useAccountStore());

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
    const client = createZksyncPasskeyClient({
      address: address.value,
      credentialPublicKey: passkey.value!,
      userName: username.value!,
      userDisplayName: username.value!,
      contracts,
      chain: chain,
      transport: http(),
    });

    return client;
  };

  const temp_getEoaClient = ({ chainId }: { chainId: SupportedChainId }) => {
    if (!address.value) throw new Error("Address is not set");
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);
    const contracts = contractsByChain[chainId];
    if (!temp_privateKey.value) throw new Error("Private key is not set");

    /*
      TODO: remove any
      `any` are set due to using zksync-account via `npm link`
      which makes it use same packages from different folders
      types are too complex to compare so it fails
    */
    const client = createZksyncEoaClient({
      address: address.value,
      privateKey: temp_privateKey.value,
      contracts,
      chain: chain,
      transport: http(),
    });

    return client;
  };

  /* TODO: remove. Temp for local dev and debugging */
  const getRichWalletClient = ({ chainId }: { chainId: SupportedChainId }) => {
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    const richWalletClient = createWalletClient({
      account: privateKeyToAccount("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110"),
      chain,
      transport: http(),
    })
      .extend(publicActions)
      .extend(walletActions);
    return richWalletClient;
  };

  return {
    getPublicClient,
    getClient,
    getRichWalletClient,
    temp_getEoaClient,
  };
});
