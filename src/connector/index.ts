import {
  ChainNotConfiguredError,
  createConnector,
  type Connector,
} from '@wagmi/core'
import {
  type Address,
  type Hex,
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
} from 'viem'
import { WalletProvider, type ProviderInterface, type SessionPreferences, type AppMetadata } from '../index.js';
import { getFavicon, getWebsiteName } from '../utils/helpers.js';

export type ZksyncAccountConnectorOptions = {
  metadata?: Partial<AppMetadata>;
  session?: SessionPreferences | (() => SessionPreferences | Promise<SessionPreferences>);
  gatewayUrl?: string;
}

export const zksyncAccountConnector = (parameters: ZksyncAccountConnectorOptions) => {
  type Provider = ProviderInterface;

  let walletProvider: WalletProvider | undefined

  let accountsChanged: Connector['onAccountsChanged'] | undefined
  let chainChanged: Connector['onChainChanged'] | undefined
  let disconnect: Connector['onDisconnect'] | undefined

  const destroyWallet = () => {
    if (walletProvider) {
      if (accountsChanged) {
        walletProvider.removeListener('accountsChanged', accountsChanged)
        accountsChanged = undefined
      }
      if (chainChanged) {
        walletProvider.removeListener('chainChanged', chainChanged)
        chainChanged = undefined
      }
      if (disconnect) {
        walletProvider.removeListener('disconnect', disconnect)
        disconnect = undefined
      }
    }
    walletProvider = undefined;
  }

  return createConnector<Provider>((config) => ({
    icon: "https://zksync.io/favicon.ico",
    id: 'zksyncAccount',
    name: 'ZKsync Account',
    // supportsSimulation: true,
    type: "zksync-account",
    async connect({ chainId } = {}) {
      try {
        const provider = await this.getProvider()
        const accounts = (
          (await provider.request({
            method: 'eth_requestAccounts',
          })) as string[]
        ).map((x) => getAddress(x))

        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this)
          provider.on('accountsChanged', accountsChanged)
        }
        if (!chainChanged) {
          chainChanged = this.onChainChanged.bind(this)
          provider.on('chainChanged', chainChanged)
        }
        if (!disconnect) {
          disconnect = this.onDisconnect.bind(this)
          provider.on('disconnect', disconnect)
        }

        // Switch to chain if provided
        let walletChainId = await this.getChainId()
        if (chainId && walletChainId !== chainId) {
          const chain = await this.switchChain!({ chainId }).catch((error) => {
            if (error.code === UserRejectedRequestError.code) throw error
            return { id: walletChainId }
          });
          walletChainId = chain?.id ?? walletChainId
        }

        return { accounts, chainId: walletChainId }
      } catch (error) {
        console.error(`Error connecting to ${this.name}`, error);
        if (
          /(user closed modal|accounts received is empty|user denied account|request rejected)/i.test(
            (error as Error).message,
          )
        )
          throw new UserRejectedRequestError(error as Error)
        throw error
      }
    },
    async disconnect() {
      const provider = await this.getProvider()
      provider.disconnect()
      destroyWallet()
    },
    async getAccounts() {
      const provider = await this.getProvider()
      return (
        await provider.request<Address[]>({
          method: 'eth_accounts',
        })
      ).map((x) => getAddress(x))
    },
    async getChainId() {
      const provider = await this.getProvider()
      const chainId = await provider.request<Hex>({
        method: 'eth_chainId',
      });
      if (!chainId) return config.chains[0].id
      return Number(chainId)
    },
    async getProvider() {
      if (!walletProvider) {
        walletProvider = new WalletProvider({
          metadata: {
            name: parameters.metadata?.name || getWebsiteName() || "Unknown DApp",
            icon: parameters.metadata?.icon || getFavicon(),
          },
          gatewayUrl: parameters.gatewayUrl,
          session: parameters.session,
          transports: config.transports,
          chains: config.chains,
        })
      }
      return walletProvider;
    },
    async isAuthorized() {
      try {
        const accounts = await this.getAccounts()
        return !!accounts.length
      } catch {
        return false
      }
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((chain) => chain.id === chainId);
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      try {
        const provider = await this.getProvider()
        await provider.request<null | undefined>({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
        return chain;
      } catch (error) {
        throw new SwitchChainError(error as Error)
      }
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect()
      else config.emitter.emit('change', {
        accounts: accounts.map((x) => getAddress(x)),
      })
    },
    onChainChanged(chain) {
      config.emitter.emit('change', { chainId: Number(chain) })
    },
    async onDisconnect(_error) {
      config.emitter.emit('disconnect')
    },
  }))
}
