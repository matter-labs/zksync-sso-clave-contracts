import type { Address } from 'viem';
import type { SerializedEthereumRpcError } from '../error/index.js';
import type { SessionData } from '../provider/index.js';

export type RPCResponseSuccessful<T> = {
  result: T
};
export type RPCResponseError = {
  error: SerializedEthereumRpcError;
};
export type RPCResponse<T> = RPCResponseSuccessful<T> | RPCResponseError;

export type HandshakeResponse = {
  result: {
    chains: {
      id: number;
      name: string;
      rpcUrl: string;
      capabilities: Record<string, unknown>;
      contracts: {
        session: Address; // Session, spend limit, etc.
      }
    }[];
    account: {
      address: Address;
      session?: SessionData;
    }
  }
};