import type { Message, MessageID } from './Message.js';
import type { RPCResponseError, RPCResponseSuccessful } from './RPCResponse.js';

interface RPCMessage<T = unknown> extends Message {
  id: MessageID;
  content: T;
  timestamp: Date;
}

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