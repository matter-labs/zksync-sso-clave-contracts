import { EventEmitter } from 'eventemitter3';

import type { Method } from './method.js';
import { AddressString, type Chain } from '../type/index.js';
import type { Hash } from 'viem';

export interface RequestArguments {
  readonly method: Method | string;
  readonly params?: readonly unknown[] | object;
}

export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

interface ProviderMessage {
  type: string;
  data: unknown;
}

interface ProviderConnectInfo {
  readonly chainId: string;
}

export interface ProviderInterface extends EventEmitter {
  request<T>(args: RequestArguments): Promise<T>;
  disconnect(): Promise<void>;
  on(event: 'connect', listener: (info: ProviderConnectInfo) => void): this;
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): this;
  on(event: 'chainChanged', listener: (chainId: string) => void): this;
  on(event: 'accountsChanged', listener: (accounts: string[]) => void): this;
  on(event: 'message', listener: (message: ProviderMessage) => void): this;
}

export interface SignerInterface {
  accounts: AddressString[];
  chain: Chain;
  handshake(): Promise<AddressString[]>;
  request<T>(request: RequestArguments): Promise<T>;
  disconnect: () => Promise<void>;
}

export interface AppMetadata {
  /** Application name */
  appName: string;
  /** Application logo image URL; favicon is used if unspecified */
  appLogoUrl: string | null;
  /** Array of chainIds your dapp supports */
  appChainIds: number[];
}

export interface Session {
  validUntil: Date;
  spendLimit: { [tokenAddress: string]: string }; // tokenAddress => amount
}

export interface SessionData extends Session {
  address: Hash;
  chainId: number;
  sessionKey: Hash;
}

export interface Preference {
  gatewayUrl?: string;
}
