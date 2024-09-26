import type { UUID } from "crypto";

type MessageID = UUID;

export interface Message {
  id: MessageID;
  requestId?: MessageID; // For responses
}

export interface Communicator {
  postMessage: (_: Message) => void;
  postRequestAndWaitForResponse: <M extends Message>(_: Message & { id: string }) => Promise<M>;
  onMessage: <M extends Message>(_: (_: Partial<M>) => boolean) => Promise<M>;
  ready: () => Promise<void>;
}
