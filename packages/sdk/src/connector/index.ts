import {
  ChainNotConfiguredError,
  type Config,
  type Connector,
  createConnector,
  getConnectorClient as wagmiGetConnectorClient,
  type GetConnectorClientParameters,
} from "@wagmi/core";
import type { Compute } from "@wagmi/core/internal";
import {
  type Account,
  type Client,
  getAddress,
  SwitchChainError,
  toHex,
  UserRejectedRequestError,
} from "viem";

import type { ZksyncSsoSessionClient } from "../client/index.js";
import { EthereumProviderError } from "../errors/errors.js";
import { type AppMetadata, type ProviderInterface, type SessionPreferences, WalletProvider } from "../index.js";
export { callPolicy } from "../client-auth-server/index.js";

export type ZksyncSsoConnectorOptions = {
  metadata?: Partial<AppMetadata>;
  session?: SessionPreferences | (() => SessionPreferences | Promise<SessionPreferences>);
  authServerUrl?: string;
};

export const zksyncSsoConnector = (parameters: ZksyncSsoConnectorOptions) => {
  type Provider = ProviderInterface;

  let walletProvider: WalletProvider | undefined;

  let accountsChanged: Connector["onAccountsChanged"] | undefined;
  let chainChanged: Connector["onChainChanged"] | undefined;
  let disconnect: Connector["onDisconnect"] | undefined;

  const destroyWallet = () => {
    if (walletProvider) {
      if (accountsChanged) {
        walletProvider.removeListener("accountsChanged", accountsChanged);
        accountsChanged = undefined;
      }
      if (chainChanged) {
        walletProvider.removeListener("chainChanged", chainChanged);
        chainChanged = undefined;
      }
      if (disconnect) {
        walletProvider.removeListener("disconnect", disconnect);
        disconnect = undefined;
      }
    }
    walletProvider = undefined;
  };

  return createConnector<Provider>((config) => ({
    icon: "https://zksync.io/favicon.ico",
    id: "zksync-sso",
    name: "ZKsync",
    // supportsSimulation: true,
    type: "zksync-sso",
    async connect({ chainId } = {}) {
      try {
        const provider = await this.getProvider();
        const accounts = (
          (await provider.request({
            method: "eth_requestAccounts",
          })) as string[]
        ).map((x) => getAddress(x));

        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this);
          provider.on("accountsChanged", accountsChanged);
        }
        if (!chainChanged) {
          chainChanged = this.onChainChanged.bind(this);
          provider.on("chainChanged", chainChanged);
        }
        if (!disconnect) {
          disconnect = this.onDisconnect.bind(this);
          provider.on("disconnect", disconnect);
        }

        // Switch to chain if provided
        let walletChainId = await this.getChainId();
        if (chainId && walletChainId !== chainId) {
          const chain = await this.switchChain!({ chainId }).catch((error) => {
            if (error.code === UserRejectedRequestError.code) throw error;
            return { id: walletChainId };
          });
          walletChainId = chain?.id ?? walletChainId;
        }

        return { accounts, chainId: walletChainId };
      } catch (error) {
        console.error(`Error connecting to ${this.name}`, error);
        if (
          /(user closed modal|accounts received is empty|user denied account|request rejected)/i.test(
            (error as Error).message,
          )
        )
          throw new UserRejectedRequestError(error as Error);
        throw error;
      }
    },
    async disconnect() {
      const provider = await this.getProvider();
      provider.disconnect();
      destroyWallet();
    },
    async getAccounts() {
      const provider = await this.getProvider();
      return (
        await provider.request({
          method: "eth_accounts",
        })
      ).map((x) => getAddress(x));
    },
    async getChainId() {
      const provider = await this.getProvider();
      const chainId = await provider.request({
        method: "eth_chainId",
      });
      if (!chainId) return config.chains[0].id;
      return Number(chainId);
    },
    async getClient(parameters) {
      if (!walletProvider) throw new Error("Wallet provider not initialized");
      return walletProvider.getClient(parameters);
    },
    async getProvider() {
      if (!walletProvider) {
        walletProvider = new WalletProvider({
          metadata: {
            name: parameters.metadata?.name,
            icon: parameters.metadata?.icon,
          },
          authServerUrl: parameters.authServerUrl,
          session: parameters.session,
          transports: config.transports,
          chains: config.chains,
        });
      }
      return walletProvider;
    },
    async isAuthorized() {
      try {
        const accounts = await this.getAccounts();
        return !!accounts.length;
      } catch {
        return false;
      }
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((chain) => chain.id === chainId);
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      try {
        const provider = await this.getProvider();
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHex(chainId) }],
        });
        return chain;
      } catch (error) {
        throw new SwitchChainError(error as Error);
      }
    },
    onAccountsChanged(accounts) {
      if (!accounts.length) return;
      config.emitter.emit("change", {
        accounts: accounts.map((x) => getAddress(x)),
      });
    },
    onChainChanged(chain) {
      config.emitter.emit("change", { chainId: Number(chain) });
    },
    async onDisconnect(error) {
      config.emitter.emit("disconnect");
      if (error instanceof EthereumProviderError && error.code === 4900) return; // User initiated
      console.error("Account disconnected", error);
    },
  }));
};

export type GetConnectedSsoClientReturnType<
  config extends Config = Config,
  chainId extends config["chains"][number]["id"] = config["chains"][number]["id"],
> = Compute<
  ZksyncSsoSessionClient<
    config["_internal"]["transports"][chainId],
    Extract<config["chains"][number], { id: chainId }>,
    undefined,
    Account
  >
>;

export const isSsoSessionClient = (client: Client): boolean => {
  return client.key === "zksync-sso-session-wallet";
};

export const isSsoSessionClientConnected = async<
  config extends Config,
  chainId extends config["chains"][number]["id"],
>(
  config: config,
  parameters: GetConnectorClientParameters<config, chainId> = {},
): Promise<boolean> => {
  const connectorClient = await wagmiGetConnectorClient(config, parameters);
  return isSsoSessionClient(connectorClient);
};

export const getConnectedSsoClient = async<
  config extends Config,
  chainId extends config["chains"][number]["id"],
>(
  config: config,
  parameters: GetConnectorClientParameters<config, chainId> = {},
): Promise<GetConnectedSsoClientReturnType<config, chainId>> => {
  const connectorClient = await wagmiGetConnectorClient(config, parameters);
  if (!isSsoSessionClient(connectorClient)) {
    throw new Error("ZKsync SSO Session Client not connected");
  }
  const sessionClient = connectorClient as unknown as GetConnectedSsoClientReturnType<config, chainId>;
  return sessionClient;
};
