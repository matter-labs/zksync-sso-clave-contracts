import { hexToNumber, http, type Address, type Chain, type Hash, type Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { HandshakeResponse, RPCRequestMessage, RPCResponseMessage, RPCResponseMessageSuccessful } from './message.js';
import type { AppMetadata, RequestArguments, SessionParameters, SessionData } from './interface.js';
import type { Method } from './method.js';
import type { Communicator } from '../communicator/index.js';
import { StorageItem } from '../utils/storage.js';
import { createZksyncWalletClient, type ZksyncAccountWalletClient } from '../client/index.js';

type Account = {
  address: Address;
  activeChainId: Chain["id"];
  session?: SessionData;
}

interface SignerInterface {
  accounts: Address[];
  chain: Chain;
  handshake(): Promise<Address[]>;
  request<T>(request: RequestArguments): Promise<T>;
  disconnect: () => Promise<void>;
}

type UpdateListener = {
  onAccountsUpdate: (_: Address[]) => void;
  onChainUpdate: (_: number) => void;
}

type SignerConstructorParams = {
  metadata: AppMetadata;
  communicator: Communicator;
  updateListener: UpdateListener;
  chains: readonly Chain[];
  transports?: Record<number, Transport>;
  session?: () => SessionParameters | Promise<SessionParameters>;
}

export class Signer implements SignerInterface {
  private readonly metadata: AppMetadata;
  private readonly communicator: Communicator;
  private readonly updateListener: UpdateListener;
  private readonly chains: readonly Chain[];
  private readonly transports: Record<number, Transport> = {};
  private readonly sessionParameters?: () => SessionParameters | Promise<SessionParameters>;

  private _account: StorageItem<Account | null>;
  private walletClient: ZksyncAccountWalletClient | undefined;

  constructor({ metadata, communicator, updateListener, session, chains, transports }: SignerConstructorParams) {
    if (!chains.length) throw new Error('At least one chain must be included in the config');

    this.metadata = metadata;
    this.communicator = communicator;
    this.updateListener = updateListener;
    this.sessionParameters = session;
    this.chains = chains;
    this.transports = transports || {};

    this._account = new StorageItem<Account | null>(StorageItem.scopedStorageKey('account'), null, {
      onChange: (newValue) => {
        if (newValue) {
          this.updateListener.onAccountsUpdate([newValue.address]);
          this.updateListener.onChainUpdate(newValue.activeChainId);
          this.createWalletClient();
        } else {
          this.updateListener.onAccountsUpdate([]);
        }
      }
    });
    if (this.account) this.createWalletClient();
  }

  private get account(): Account | null {
    const account = this._account.get();
    if (!account) return null;
    const chain = this.chains.find(e => e.id === account.activeChainId);
    return {
      ...account,
      activeChainId: chain?.id || this.chains[0]!.id,
    }
  }
  private get session() { return this.account?.session }
  private readonly clearState = () => {
    this._account.remove();
  }
  
  public get accounts() { return this.account ? [this.account.address] : [] }
  public get chain() {
    const chainId = this.account?.activeChainId || this.chains[0]!.id;
    return this.chains.find(e => e.id === chainId)!;
  }

  createWalletClient() {
    const session = this.session;
    const chain = this.chain;
    if (!session) throw new Error('Session is not set');
    if (!('name' in chain)) throw new Error('Chains not set up or not supported');
    this.walletClient = createZksyncWalletClient({
      address: privateKeyToAccount(session.sessionKey).address,
      chain,
      transport: this.transports[chain.id] || http(),
      session: session,
    } as any) as any; 
  }

  async handshake(): Promise<Address[]> {
    let session: SessionParameters | undefined;
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

    /* this._chains.set(response.result.chains); */
    this._account.set({
      address: response.result.account.address,
      activeChainId: response.result.account.session?.chainId || this.chain.id,
      session: response.result.account.session,
    });
    return this.accounts;
  }

  switchChain(chainId: number): boolean {
    const chain = this.chains.find((chain) => chain.id === chainId);
    if (!chain) return false;
    if (chain.id === this.chain.id) return true;

    this._account.set({
      ...this.account!,
      activeChainId: chain.id,
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
        const res = await this.walletClient.sendTransaction(params[0]);
        return res as T;

      case 'wallet_switchEthereumChain': {
        const chainId = params[0].chainId;
        const switched = this.switchChain(typeof chainId === 'string' ? hexToNumber(chainId as Hash) : chainId);
        // "return null if the request was successful"
        // https://eips.ethereum.org/EIPS/eip-3326#wallet_switchethereumchain
        return switched ? (null as T) : undefined;
      }
      case 'wallet_getCapabilities': {
        // return Object.fromEntries(this.chains.map((e) => [e.id, e.capabilities])) as T;
        return {} as T;
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
