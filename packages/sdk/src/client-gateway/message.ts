import type { UUID } from 'crypto';
import type { Address } from 'viem';
import type { SessionData } from './interface.js';
import type { SerializedEthereumRpcError } from '../errors/index.js';
import type { ZksyncAccountContracts } from '../client/index.js';

export type MessageID = UUID;

export interface Message {
  id?: MessageID;
  requestId?: MessageID;
  data?: unknown;
}

interface RPCMessage<T = unknown> extends Message {
  id: MessageID;
  content: T;
  timestamp: Date;
}

/* Request */
export interface RPCRequestMessage<T = unknown> extends RPCMessage<T> {}
export interface RPCResponseMessageSuccessful<T = unknown> extends RPCMessage<RPCResponseSuccessful<T>> {
  requestId: MessageID;
  content: RPCResponseSuccessful<T>;
}
export interface RPCResponseMessageFailure extends RPCMessage<RPCResponseError> {
  requestId: MessageID;
  content: RPCResponseError;
}
export type RPCResponseMessage<T = unknown> = RPCResponseMessageSuccessful<T> | RPCResponseMessageFailure;

/* Response */
export type RPCResponseSuccessful<T> = { result: T };
export type RPCResponseError = { error: SerializedEthereumRpcError };
export type RPCResponse<T> = RPCResponseSuccessful<T> | RPCResponseError;
export type HandshakeResponse = {
  result: {
    account: {
      address: Address;
      activeChainId: number;
      session?: SessionData;
    }
    chainsInfo: {
      id: number;
      capabilities: Record<string, unknown>;
      contracts: ZksyncAccountContracts
    }[];
  }
};

