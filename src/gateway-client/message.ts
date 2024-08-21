import type { UUID } from 'crypto';
import type { SerializedEthereumRpcError } from '../errors/index.js';
import type { Address } from 'viem';
import type { SessionData } from './interface.js';

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
    chains: {
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

