import { privateKeyToAccount } from 'viem/accounts';
import { http, type Address } from 'viem';

import type { StateUpdateListener } from './interface.js';
import type { HandshakeResponse, RPCRequestMessage, RPCResponseMessage, RPCResponseMessageSuccessful } from '../core/message/index.js';
import type { AppMetadata, RequestArguments, Session, SessionData, SignerInterface } from '../core/provider/interface.js';
import type { Method } from '../core/provider/method.js';
import { ensureIntNumber } from '../core/type/util.js';
import type { Communicator } from '../core/communicator/index.js';
import { createZksyncWalletClient } from '../account/index.js';
import { StorageItem } from '../utils/storage.js';
import type { ZksyncWalletClient } from '../account/zksync-account.js';
import type { ChainData } from '../core/type/index.js';

type Account = {
  address: Address;
  activeChain: ChainData["id"];
  session?: SessionData;
}

export class Signer implements SignerInterface {
  private readonly metadata: AppMetadata;
  private readonly communicator: Communicator;
  private readonly sessionParameters?: () => Session | Promise<Session>;
  private readonly updateListener: StateUpdateListener;

  private readonly getScopeKey = (key: string) => `ZKAccount::${key}`;
  private _chains: StorageItem<ChainData[]>;
  private _account: StorageItem<Account | null>;
  private walletClient: ZksyncWalletClient | undefined;

  constructor(params: {
    metadata: AppMetadata;
    communicator: Communicator;
    updateListener: StateUpdateListener;
    session?: () => Session | Promise<Session>;
  }) {
    if (!params.metadata.appChainIds.length) throw new Error('At least one chain id must be provided');

    this.metadata = params.metadata;
    this.communicator = params.communicator;
    this.sessionParameters = params.session;
    this.updateListener = params.updateListener;

    this._account = new StorageItem<Account | null>(this.getScopeKey('account'), null, {
      onChange: (newValue) => {
        if (newValue) {
          this.updateListener.onAccountsUpdate([newValue.address]);
          this.updateListener.onChainUpdate(newValue.activeChain);
        } else {
          this.updateListener.onAccountsUpdate([]);
        }
      }
    });
    this._chains = new StorageItem<ChainData[]>(this.getScopeKey('chains'), []);
  }

  private get chains() { return this._chains.get() }
  private get account() { return this._account.get() }
  public get accounts() { return this.account ? [this.account.address] : [] }
  private get session() { return this.account?.session }
  public get chain() {
    const chainId = this.account?.activeChain || this.metadata.appChainIds[0];
    return Object.entries(this.chains).find(([_, chain]) => chain.id === chainId)?.[1] || { id: chainId! };
  }
  private readonly clearState = () => {
    this._chains.remove();
    this._account.remove();
  }

  createWalletClient() {
    const session = this.session;
    const chain = this.chain;
    if (!session) throw new Error('Session is not set');
    if (!('name' in chain)) throw new Error('Chains not set up or not supported');
    this.walletClient = createZksyncWalletClient({
      address: privateKeyToAccount(session.sessionKey).address,
      session: session,
      chain: {
        id: chain.id,
        name: chain.name,
        rpcUrls: { default: { http: [chain.rpcUrl] } },
        contracts: Object.fromEntries(Object.entries(chain.contracts).map(
          ([key, address]) => [key, { address }]
        )),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      },
      transport: http(),
    }); 
  }

  async handshake(): Promise<Address[]> {
    let session: Session | undefined;
    if (this.sessionParameters) {
      try {
        session = await this.sessionParameters();
      } catch (error) {
        console.error('Failed to get session data. Proceeding connection with no session.', error);
      }
    }
    const responseMessage = await this.sendRpcRequest({
      method: 'eth_requestAccounts',
      params: {
        metadata: this.metadata,
        session,
      },
    });
    const response = responseMessage.content as HandshakeResponse;

    this._chains.set(response.result.chains);
    this._account.set({
      address: response.result.account.address,
      activeChain: response.result.chains[0]!.id,
      session: response.result.account.session,
    });
    this.createWalletClient();
    return this.accounts;
  }

  switchChain(chainId: number): boolean {
    const chain = this.chains.find((chain) => chain.id === chainId);
    if (!chain) return false;
    if (chain.id === this.chain.id) return true;

    this._account.set({
      ...this.account!,
      activeChain: chain.id,
    });
    return true;
  }

  async request<T>(request: RequestArguments): Promise<T> {
    const localResult = await this.tryLocalHandling<T>(request);
    if (localResult !== undefined) return localResult;

    const response = await this.sendRpcRequest<T>(request);
    return response.content.result;
  }

  async disconnect() {
    this.clearState();
  }

  private async tryLocalHandling<T>(request: RequestArguments): Promise<T | undefined> {
    const params = request.params as any;
    switch (request.method as Method) {
      case 'eth_sendTransaction':
        if (!this.walletClient || !this.session) return undefined;
        console.log(params[0]);
        const res = await this.walletClient.sendTransaction(params[0]);
        return res as T;

      case 'wallet_switchEthereumChain': {
        const chainId = ensureIntNumber(params[0].chainId);
        const switched = this.switchChain(chainId);
        // "return null if the request was successful"
        // https://eips.ethereum.org/EIPS/eip-3326#wallet_switchethereumchain
        return switched ? (null as T) : undefined;
      }
      case 'wallet_getCapabilities': {
        if (!this.chains.length) throw new Error('Chains are not set');
        return Object.fromEntries(this.chains.map((e) => [e.id, e.capabilities])) as T;
      }
      default:
        return undefined;
    }
  }

  private async sendRpcRequest<T>(request: RequestArguments): Promise<RPCResponseMessageSuccessful<T>> {
    // Open the popup before constructing the request message.
    // This is to ensure that the popup is not blocked by some browsers (i.e. Safari)
    await this.communicator.ready();

    const message = await this.createRequestMessage({
      action: request,
      chainId: this.chain.id,
    });

    const response: RPCResponseMessage<T> = await this.communicator.postRequestAndWaitForResponse(message);
    
    const content = response.content;
    if ('error' in content) throw content.error;
    
    return response as RPCResponseMessageSuccessful<T>;
  }

  private async createRequestMessage<T>(
    content: RPCRequestMessage<T>['content']
  ): Promise<RPCRequestMessage<T>> {
    return {
      id: crypto.randomUUID(),
      content,
      timestamp: new Date(),
    };
  }
}
