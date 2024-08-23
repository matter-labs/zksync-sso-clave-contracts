import type { UUID } from "crypto";
import type { Address } from "viem";
import type { ZksyncAccountContracts } from "../client/createWalletClient";
import type { SerializedEthereumRpcError } from "../errors/index";
import type { SessionData } from "./interface";

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
export type RPCRequestMessage<T = unknown> = RPCMessage<T>;
export interface RPCResponseMessageSuccessful<T = unknown>
  extends RPCMessage<RPCResponseSuccessful<T>> {
  requestId: MessageID;
  content: RPCResponseSuccessful<T>;
}
export interface RPCResponseMessageFailure
  extends RPCMessage<RPCResponseError> {
  requestId: MessageID;
  content: RPCResponseError;
}
export type RPCResponseMessage<T = unknown> =
  | RPCResponseMessageSuccessful<T>
  | RPCResponseMessageFailure;

/* Response */
export type RPCResponseSuccessful<T> = { result: T };
export type RPCResponseError = { error: SerializedEthereumRpcError };
export type RPCResponse<T> = RPCResponseSuccessful<T> | RPCResponseError;
export type HandshakeResponse = {
  result: {
    chainsInfo: {
      id: number;
      capabilities: Record<string, unknown>;
      contracts: ZksyncAccountContracts;
    }[];
    account: {
      address: Address;
      session?: SessionData;
    };
  };
};
