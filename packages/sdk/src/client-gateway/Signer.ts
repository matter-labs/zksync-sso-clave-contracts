import { hexToNumber, http, type Address, type Chain, type Hash, type Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { HandshakeResponse, RPCRequestMessage, RPCResponseMessage, RPCResponseMessageSuccessful } from './message.js';
import type { AppMetadata, RequestArguments, SessionPreferences, SessionData } from './interface.js';
import type { Method } from './method.js';
import type { Communicator } from '../communicator/index.js';
import { StorageItem } from '../utils/storage.js';
import { createZksyncSessionClient, type ZksyncAccountSessionClient } from '../client/index.js';

type Account = {
  address: Address;
  activeChainId: Chain["id"];
  session?: SessionData | undefined;
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
  session?: () => SessionPreferences | Promise<SessionPreferences>;
}

type ChainsInfo = HandshakeResponse["result"]["chainsInfo"];

export class Signer implements SignerInterface {
  private readonly metadata: AppMetadata;
  private readonly communicator: Communicator;
  private readonly updateListener: UpdateListener;
  private readonly chains: readonly Chain[];
  private readonly transports: Record<number, Transport> = {};
  private readonly sessionParameters?: () => SessionPreferences | Promise<SessionPreferences>;

  private _account: StorageItem<Account | null>;
  private _chainsInfo = new StorageItem<ChainsInfo>(StorageItem.scopedStorageKey('chainsInfo'), []);
  private walletClient: ZksyncAccountSessionClient | undefined;

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
  private get chainsInfo() { return this._chainsInfo.get() }
  private readonly clearState = () => {
    this._account.remove();
    this._chainsInfo.remove();
  }
  
  public get accounts() { return this.account ? [this.account.address] : [] }
  public get chain() {
    const chainId = this.account?.activeChainId || this.chains[0]!.id;
    return this.chains.find(e => e.id === chainId)!;
  }

  createWalletClient() {
    const session = this.session;
    const chain = this.chain;
    const chainInfo = this.chainsInfo.find(e => e.id === chain.id);
    if (!session) throw new Error('Session is not set');
    if (!chainInfo) throw new Error(`Chain info for ${chain} wasn't set during handshake`);
    this.walletClient = createZksyncSessionClient({
      address: privateKeyToAccount(session.sessionKey).address,
      contracts: chainInfo.contracts,
      chain,
      transport: this.transports[chain.id] || http(),
      sessionKey: session.sessionKey,
    }); 
  }

  async handshake(): Promise<Address[]> {
    let session: SessionPreferences | undefined;
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

    this._account.set({
      address: response.result.account.address,
      activeChainId: response.result.account.activeChainId || this.chain.id,
      session: response.result.account.session,
    });
    this._chainsInfo.set(response.result.chainsInfo);
    return this.accounts;
  }

  switchChain(chainId: number): boolean {
    const chain = this.chains.find((chain) => chain.id === chainId);
    const chainInfo = this.chainsInfo.find(e => e.id === chainId);
    if (!chainInfo) {
      console.error(`Chain ${chainId} is not supported or chain info was not set during handshake`);
      return false;
    };
    if (!chain) {
      console.error(`Chain ${chainId} is missing in the configuration`);
      return false;
    };
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
        const chainInfo = this.chainsInfo.find(e => e.id === this.chain.id);
        if (!chainInfo) throw new Error('Chain info is not set');
        return { [this.chain.id]: chainInfo.capabilities } as T;
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
