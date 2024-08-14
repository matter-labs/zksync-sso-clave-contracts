import { EventEmitter } from 'eventemitter3';

import { standardErrorCodes, standardErrors } from './core/error/index.js';
import { serializeError } from './core/error/serialize.js';
import type {
  AppMetadata,
  ProviderInterface,
  RequestArguments,
  Session,
} from './core/provider/interface.js';
import { AddressString, type Chain, IntNumber } from './core/type/index.js';
import { areAddressArraysEqual, hexStringFromIntNumber } from './core/type/util.js';
import { checkErrorForInvalidRequestArgs, fetchRPCRequest } from './util/provider.js';
import { PopupCommunicator } from './core/communicator/PopupCommunicator.js';
import { determineMethodCategory } from './core/provider/method.js';
import { Signer } from './signer/Signer.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3001/confirm';

export type WalletProviderConstructorOptions = {
  metadata: AppMetadata;
  session?: () => Session | Promise<Session>;
  gatewayUrl?: string;
};

export class WalletProvider extends EventEmitter implements ProviderInterface {
  readonly isZksyncAccount = true;
  private signer: Signer;

  constructor({ metadata, session, gatewayUrl }: {
    metadata: AppMetadata;
    session?: () => Session | Promise<Session>;
    gatewayUrl?: string
  }) {
    super();
    const communicator = new PopupCommunicator(gatewayUrl || DEFAULT_GATEWAY_URL)
    this.signer = new Signer({
      metadata,
      updateListener: this.updateListener,
      communicator: communicator,
      session,
    })
  }

  protected get chain() {
    return this.signer.chain;
  }
  public get connected() {
    return this.signer.accounts.length > 0;
  }

  public async request<T>(args: RequestArguments): Promise<T> {
    try {
      checkErrorForInvalidRequestArgs(args);
      // unrecognized methods are treated as fetch requests
      const category = determineMethodCategory(args.method) ?? 'fetch';
      return this.handlers[category](args) as T;
    } catch (error) {
      this.handleUnauthorizedError(error);
      return Promise.reject(serializeError(error, args.method));
    }
  }

  protected readonly handlers = {
    // eth_requestAccounts
    handshake: async (_: RequestArguments): Promise<AddressString[]> => {
      if (this.connected) {
        this.emit('connect', { chainId: hexStringFromIntNumber(IntNumber(this.chain.id)) });
        return this.signer.accounts;
      }

      const accounts = await this.signer.handshake();

      this.emit('connect', { chainId: hexStringFromIntNumber(IntNumber(this.chain.id)) });
      return accounts;
    },

    sign: async (request: RequestArguments) => {
      if (!this.connected) {
        throw standardErrors.provider.unauthorized(
          "Must call 'eth_requestAccounts' before other methods"
        );
      }
      return await this.signer.request(request);
    },

    fetch: (request: RequestArguments) => fetchRPCRequest(request, this.chain),

    state: (request: RequestArguments) => {
      const getConnectedAccounts = (): AddressString[] => {
        if (this.connected) return this.signer.accounts;
        throw standardErrors.provider.unauthorized(
          "Must call 'eth_requestAccounts' before other methods"
        );
      };
      switch (request.method) {
        case 'eth_chainId':
          return hexStringFromIntNumber(IntNumber(this.chain.id));
        case 'net_version':
          return this.chain.id;
        case 'eth_accounts':
          return getConnectedAccounts();
        default:
          return this.handlers.unsupported(request);
      }
    },

    deprecated: ({ method }: RequestArguments) => {
      throw standardErrors.rpc.methodNotSupported(`Method ${method} is deprecated.`);
    },

    unsupported: ({ method }: RequestArguments) => {
      throw standardErrors.rpc.methodNotSupported(`Method ${method} is not supported.`);
    },
  };

  private handleUnauthorizedError(error: unknown) {
    const e = error as { code?: number };
    if (e.code === standardErrorCodes.provider.unauthorized) this.disconnect();
  }

  /** @deprecated Use `.request({ method: 'eth_requestAccounts' })` instead. */
  public async enable(): Promise<unknown> {
    console.warn(
      `.enable() has been deprecated. Please use .request({ method: "eth_requestAccounts" }) instead.`
    );
    return await this.request({
      method: 'eth_requestAccounts',
    });
  }

  async disconnect(): Promise<void> {
    this.signer.disconnect();
    this.emit('disconnect', standardErrors.provider.disconnected('User initiated disconnection'));
  }

  protected readonly updateListener = {
    onAccountsUpdate: (accounts: AddressString[]) => {
      if (areAddressArraysEqual(this.signer.accounts, accounts)) return;
      this.emit('accountsChanged', this.signer.accounts);
    },
    onChainUpdate: (chain: Chain) => {
      if (chain.id === this.chain.id && chain.rpcUrl === this.chain.rpcUrl) return;
      this.emit('chainChanged', hexStringFromIntNumber(IntNumber(chain.id)));
    },
  };
}
