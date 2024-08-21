import { EventEmitter } from 'eventemitter3';

import type { Method } from './method.js';
import type { Address, Hash } from 'viem';

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

export interface AppMetadata {
  name: string;
  icon: string | null;
}

export interface SessionPreferences {
  validUntil: Date;
  spendLimit: { [tokenAddress: Address]: string }; // tokenAddress => amount
}

export interface SessionData extends SessionPreferences {
  address: Address;
  chainId: number;
  sessionKey: Hash;
}
