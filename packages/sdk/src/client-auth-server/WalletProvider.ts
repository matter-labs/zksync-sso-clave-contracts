import { EventEmitter } from "eventemitter3";
import type { Address, Chain, Transport } from "viem";
import { toHex } from "viem";

import { PopupCommunicator } from "../communicator/PopupCommunicator.js";
import { serializeError, standardErrors } from "../errors/index.js";
import { getFavicon, getWebsiteName } from "../utils/helpers.js";
import type {
  AppMetadata,
  ProviderInterface,
  RequestArguments,
} from "./interface.js";
import { type ExtractReturnType, type Method } from "./rpc.js";
import type { SessionPreferences } from "./session/index.js";
import { Signer } from "./Signer.js";

const DEFAULT_AUTH_SERVER_URL = "https://auth-test.zksync.dev/confirm";

export type WalletProviderConstructorOptions = {
  metadata: Partial<AppMetadata> | undefined;
  chains: readonly Chain[];
  transports?: Record<number, Transport>;
  session?: SessionPreferences | (() => SessionPreferences | Promise<SessionPreferences>);
  authServerUrl?: string;
};

export class WalletProvider extends EventEmitter implements ProviderInterface {
  readonly isZksyncSso = true;
  private signer: Signer;

  constructor({ metadata, chains, transports, session, authServerUrl }: WalletProviderConstructorOptions) {
    super();
    const communicator = new PopupCommunicator(authServerUrl || DEFAULT_AUTH_SERVER_URL);
    this.signer = new Signer({
      metadata: () => ({
        name: metadata?.name || getWebsiteName() || "Unknown DApp",
        icon: metadata?.icon || getFavicon(),
      }),
      updateListener: this.updateListener,
      communicator: communicator,
      chains,
      transports,
      session: typeof session === "object" ? () => session : session,
    });
  }

  protected get chain() {
    return this.signer.chain;
  }

  public get connected() {
    return this.signer.accounts.length > 0;
  }

  public getClient(parameters?: { chainId?: number }) {
    return this.signer.getClient(parameters);
  }

  public async request<M extends Method>(request: RequestArguments<M>): Promise<ExtractReturnType<M>> {
    try {
      switch (request.method) {
        case "eth_requestAccounts": {
          return await this.handshake() as ExtractReturnType<M>;
        }
        case "personal_sign":
        case "eth_accounts":
        case "eth_estimateGas":
        case "eth_signTransaction":
        case "eth_sendTransaction":
        case "eth_signTypedData_v4":
        case "wallet_addEthereumChain":
        case "wallet_switchEthereumChain":
        case "wallet_watchAsset":
        case "wallet_getCapabilities":
        case "wallet_sendCalls":
        case "wallet_showCallsStatus": {
          if (!this.connected) {
            throw standardErrors.provider.unauthorized(
              "Must call 'eth_requestAccounts' before other methods",
            );
          }
          return await this.signer.request(request) as ExtractReturnType<M>;
        }
        case "eth_chainId":
        case "net_version": {
          return toHex(this.chain.id) as ExtractReturnType<M>;
        }
      }
      throw standardErrors.rpc.methodNotSupported(`Method ${request.method} is not supported.`);
    } catch (error) {
      return Promise.reject(serializeError(error, request.method));
    }
  }

  public async handshake(): Promise<Address[]> {
    if (this.connected) {
      this.emit("connect", { chainId: this.chain.id });
      return this.signer.accounts;
    }
    const accounts = await this.signer.handshake();
    this.emit("connect", { chainId: this.chain.id });
    return accounts;
  }

  async disconnect(): Promise<void> {
    this.signer.disconnect();
    this.emit("disconnect", standardErrors.provider.disconnected("User initiated disconnection"));
  }

  protected readonly updateListener = {
    onAccountsUpdate: (accounts: Address[]) => {
      this.emit("accountsChanged", accounts);
    },
    onChainUpdate: (chainId: number) => {
      this.emit("chainChanged", chainId);
    },
  };
}
