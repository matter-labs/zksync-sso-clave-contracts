import type { Message, MessageID } from './Message.js';
import type { RPCResponse } from './RPCResponse.js';
import type { SerializedEthereumRpcError } from '../error/index.js';

interface RPCMessage extends Message {
  id: MessageID;
  content: unknown;
  timestamp: Date;
}

export interface RPCRequestMessage extends RPCMessage {
  content: {
    data: unknown;
  };
}

export interface RPCResponseMessage<T = unknown> extends RPCMessage {
  requestId: MessageID;
  content:
    | RPCResponse<T>
    | {
        failure: SerializedEthereumRpcError;
      };
}
