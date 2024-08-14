import {
  ChainNotConfiguredError,
  createConnector,
  type Connector,
} from '@wagmi/core'
import {
  type AddEthereumChainParameter,
  type Hex,
  type ProviderRpcError,
  SwitchChainError,
  UserRejectedRequestError,
  getAddress,
  numberToHex,
} from 'viem'
import { WalletProvider, type ProviderInterface, type Session, type AppMetadata } from '../index.js';
import { getFavicon } from '../core/type/util.js';

export type ZksyncAccountConnectorOptions = {
  metadata: Partial<AppMetadata> & { appName: string };
  session?: () => Session | Promise<Session>;
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
        console.log({walletChainId, chainId})
        if (chainId && walletChainId !== chainId) {
          const chain = await this.switchChain!({ chainId }).catch((error) => {
            console.log({error});
            if (error.code === UserRejectedRequestError.code) throw error
            return { id: walletChainId }
          })
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
        await provider.request<string[]>({
          method: 'eth_accounts',
        })
      ).map((x) => getAddress(x))
    },
    async getChainId() {
      const provider = await this.getProvider()
      const chainId = await provider.request<Hex>({
        method: 'eth_chainId',
      })
      return Number(chainId)
    },
    async getProvider() {
      if (!walletProvider) {
        walletProvider = new WalletProvider({
          metadata: {
            appName: parameters.metadata.appName,
            appLogoUrl: parameters.metadata.appLogoUrl || getFavicon(),
            appChainIds: parameters.metadata.appChainIds ?? config.chains.map((chain) => chain.id),
          },
          gatewayUrl: parameters.gatewayUrl,
          session: parameters.session,
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
    async switchChain({ addEthereumChainParameter, chainId }) {
      const chain = config.chains.find((chain) => chain.id === chainId)
      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError())

      const provider = await this.getProvider()

      try {
        console.log("Request switch chain", chain);
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: numberToHex(chain.id) }],
        })
        return chain;
      } catch (error) {
        // Indicates chain is not added to provider
        if ((error as ProviderRpcError).code === 4902) {
          try {
            let blockExplorerUrls: string[] | undefined
            if (addEthereumChainParameter?.blockExplorerUrls)
              blockExplorerUrls = addEthereumChainParameter.blockExplorerUrls
            else
              blockExplorerUrls = chain.blockExplorers?.default.url
                ? [chain.blockExplorers?.default.url]
                : []

            let rpcUrls: readonly string[]
            if (addEthereumChainParameter?.rpcUrls?.length)
              rpcUrls = addEthereumChainParameter.rpcUrls
            else rpcUrls = [chain.rpcUrls.default?.http[0] ?? '']

            const addEthereumChain = {
              blockExplorerUrls,
              chainId: numberToHex(chainId),
              chainName: addEthereumChainParameter?.chainName ?? chain.name,
              iconUrls: addEthereumChainParameter?.iconUrls,
              nativeCurrency:
                addEthereumChainParameter?.nativeCurrency ??
                chain.nativeCurrency,
              rpcUrls,
            } satisfies AddEthereumChainParameter

            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [addEthereumChain],
            })

            return chain
          } catch (error) {
            throw new UserRejectedRequestError(error as Error)
          }
        }

        throw new SwitchChainError(error as Error)
      }
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect()
      else
        config.emitter.emit('change', {
          accounts: accounts.map((x) => getAddress(x)),
        })
    },
    onChainChanged(chain) {
      const chainId = Number(chain)
      config.emitter.emit('change', { chainId })
    },
    async onDisconnect(_error) {
      config.emitter.emit('disconnect')
    },
  }))
}
