import { createPublicClient, createWalletClient, http, publicActions, walletActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { zksync, zksyncInMemoryNode, zksyncSepoliaTestnet } from "viem/chains";
import { createZksyncPasskeyClient, type PasskeyRequiredContracts } from "zksync-account/client/passkey";

export const supportedChains = [zksync, zksyncSepoliaTestnet, zksyncInMemoryNode];
export type SupportedChainId = (typeof supportedChains)[number]["id"];
export const blockExplorerApiByChain: Record<SupportedChainId, string> = {
  [zksync.id]: zksync.blockExplorers.native.apiUrl,
  [zksyncSepoliaTestnet.id]: zksyncSepoliaTestnet.blockExplorers.native.blockExplorerApi,
  [zksyncInMemoryNode.id]: "http://localhost:8011",
};

type ChainContracts = PasskeyRequiredContracts & {
  accountFactory: NonNullable<PasskeyRequiredContracts["accountFactory"]>;
  accountImplementation: NonNullable<PasskeyRequiredContracts["accountImplementation"]>;
};
export const contractsByChain: Record<SupportedChainId, ChainContracts> = {
  [zksync.id]: {
    session: "0x",
    passkey: "0x",
    accountFactory: "0x",
    accountImplementation: "0x",
  },
  [zksyncSepoliaTestnet.id]: {
    session: "0x",
    passkey: "0x",
    accountFactory: "0x",
    accountImplementation: "0x",
  },
  [zksyncInMemoryNode.id]: {
    session: "0x476F23ef274F244282252341792c8a610feF78ee",
    passkey: "0x455e8d86DC6728396f8d3B740Fc893F4E20b25Dc",
    accountFactory: "0x23b13d016E973C9915c6252271fF06cCA2098885",
    accountImplementation: "0x6cd5A2354Be0E656e7A1E94F1C0570E08EC4789B",
  },
};

export const useClientStore = defineStore("client", () => {
  const { address, username, passkey } = storeToRefs(useAccountStore());

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

  /* TODO: remove. Temp for local dev and debugging */
  const getRichWalletClient = ({ chainId }: { chainId: SupportedChainId }) => {
    const chain = supportedChains.find((chain) => chain.id === chainId);
    if (!chain) throw new Error(`Chain with id ${chainId} is not supported`);

    const richWalletClient = createWalletClient({
      account: privateKeyToAccount("0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e"),
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
  };
});
