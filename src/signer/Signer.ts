import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, publicActions, type Hash } from 'viem';
import { zksyncSepoliaTestnet } from 'viem/zksync';

import type { StateUpdateListener } from './interface.js';
import { SignerStateManager } from './SignerStateManager.js';
import { standardErrors } from '../core/error/index.js';
import type { RPCRequestMessage, RPCResponse, RPCResponseMessage } from '../core/message/index.js';
import type { AppMetadata, RequestArguments, Session, SignerInterface } from '../core/provider/interface.js';
import type { Method } from '../core/provider/method.js';
import { AddressString } from '../core/type/index.js';
import { ensureIntNumber } from '../core/type/util.js';
import type { Communicator } from '../core/communicator/index.js';

type SwitchEthereumChainParam = [
  {
    chainId: `0x${string}`; // Hex chain id
  },
];

export class Signer implements SignerInterface {
  private readonly metadata: AppMetadata;
  private readonly communicator: Communicator;
  private readonly stateManager: SignerStateManager;
  private readonly getSession?: () => Session | Promise<Session>;

  constructor(params: {
    metadata: AppMetadata;
    communicator: Communicator;
    updateListener: StateUpdateListener;
    session?: () => Session | Promise<Session>;
  }) {
    if (!params.metadata.appChainIds.length) throw new Error('At least one chain id must be provided');

    this.metadata = params.metadata;
    this.communicator = params.communicator;
    this.stateManager = new SignerStateManager({
      appChainIds: this.metadata.appChainIds,
      updateListener: params.updateListener,
    });
    this.getSession = params.session;

    this.handshake = this.handshake.bind(this);
    this.request = this.request.bind(this);
    this.createRequestMessage = this.createRequestMessage.bind(this);
    this.processResponseMessage = this.processResponseMessage.bind(this);
  }

  public get accounts() {
    return this.stateManager.accounts;
  }
  public get chain() {
    return this.stateManager.activeChain;
  }
  private get session() {
    return this.stateManager.session;
  }

  async handshake(): Promise<AddressString[]> {
    let session: Session | undefined;
    if (this.getSession) {
      try {
        session = await this.getSession();
      } catch (error) {
        console.error('Failed to get session data. Proceeding connection with no session.', error);
      }
    }
    return await this.request({
      method: 'eth_requestAccounts',
      params: {
        metadata: this.metadata,
        session,
      },
    });
  }

  async request<T>(request: RequestArguments): Promise<T> {
    const localResult = await this.tryLocalHandling<T>(request);
    if (localResult !== undefined) {
      if (localResult instanceof Error) throw localResult;
      return localResult;
    }

    // Open the popup before constructing the request message.
    // This is to ensure that the popup is not blocked by some browsers (i.e. Safari)
    await this.communicator.ready();

    const response = await this.sendRpcRequest(request);
    const rpcResponse = await this.processResponseMessage<T>(response);
    this.updateInternalState(request, rpcResponse);

    const result = rpcResponse.result;
    if ('error' in result) throw result.error;

    return result.value;
  }

  async disconnect() {
    this.stateManager.clear();
  }

  private getWalletClient() {
    if (!this.session) throw new Error("No session data");
    // const chain = supportedChains.find((chain) => chain.id === chainId);
    // if (!chain) throw new Error("Chain not supported");
    const walletClient = createWalletClient({
      account: privateKeyToAccount(this.session.sessionKey),
      chain: zksyncSepoliaTestnet,
      transport: http(),
    }).extend(publicActions);
    return walletClient;
  };

  private async tryLocalHandling<T>(request: RequestArguments): Promise<T | undefined> {
    const session = this.stateManager.session;
    console.log({request, session});
    switch (request.method as Method) {
      case 'eth_sendTransaction':
        if (!this.session) return undefined;
        const client = this.getWalletClient();
        const params = request.params;
        const transactionParams: { from: Hash; to: Hash; gas: Hash; gasPrice: Hash; type: Hash; value: Hash } = params[0];
        const res = await client.sendTransaction({
          gas: BigInt(transactionParams.gas),
          gasPrice: BigInt(transactionParams.gasPrice),
          to: transactionParams.to,
          value: BigInt(transactionParams.value),
        });
        console.log({res})
        return res as T;

      case 'wallet_switchEthereumChain': {
        const params = request.params as SwitchEthereumChainParam;
        if (!params || !params[0]?.chainId) {
          throw standardErrors.rpc.invalidParams();
        }
        const chainId = ensureIntNumber(params[0].chainId);
        const switched = this.stateManager.switchChain(chainId);
        // "return null if the request was successful"
        // https://eips.ethereum.org/EIPS/eip-3326#wallet_switchethereumchain
        return switched ? (null as T) : undefined;
      }
      case 'wallet_getCapabilities': {
        const walletCapabilities = this.stateManager.walletCapabilities;
        if (!walletCapabilities) {
          // This should never be the case as capabilities are set during handshake
          throw standardErrors.provider.unauthorized(
            'No wallet capabilities found, please disconnect and reconnect'
          );
        }
        return walletCapabilities as T;
      }
      default:
        return undefined;
    }
  }

  private async sendRpcRequest(request: RequestArguments): Promise<RPCResponseMessage> {
    const message = await this.createRequestMessage({
      data: {
        action: request,
        chainId: this.stateManager.activeChain.id,
      },
    });

    return this.communicator.postRequestAndWaitForResponse(message);
  }

  private async createRequestMessage(
    content: RPCRequestMessage['content']
  ): Promise<RPCRequestMessage> {
    return {
      id: crypto.randomUUID(),
      content,
      timestamp: new Date(),
    };
  }

  private processResponseMessage<T>(message: RPCResponseMessage): RPCResponse<T> {
    const content = message.content;

    // throw protocol level error
    if ('failure' in content) {
      throw content.failure;
    }

    return content as RPCResponse<T>;
  }

  private updateInternalState<T>(request: RequestArguments, response: RPCResponse<T>) {
    const availableChains = response.data?.chains;
    if (availableChains) {
      this.stateManager.updateAvailableChains(availableChains);
    }

    const walletCapabilities = response.data?.capabilities;
    if (walletCapabilities) {
      this.stateManager.updateWalletCapabilities(walletCapabilities);
    }

    const session = response.data?.session;
    if (session) {
      this.stateManager.updateSession(session);
    }

    const result = response.result;
    if ('error' in result) return;

    switch (request.method as Method) {
      case 'eth_requestAccounts': {
        const accounts = result.value as AddressString[];
        this.stateManager.updateAccounts(accounts);
        break;
      }
      case 'wallet_switchEthereumChain': {
        console.log('Switch chain response', result.value);
        // "return null if the request was successful"
        // https://eips.ethereum.org/EIPS/eip-3326#wallet_switchethereumchain
        if (result.value !== null) return;

        const params = request.params as SwitchEthereumChainParam;
        const chainId = ensureIntNumber(params[0].chainId);
        this.stateManager.switchChain(chainId);
        break;
      }
      default:
        break;
    }
  }
}
