import type { Message } from "../client-gateway/message.js";

export interface Communicator {
  postMessage: (_: Message) => void;
  postRequestAndWaitForResponse: <M extends Message>(_: Message & { id: string }) => Promise<M>;
  onMessage: <M extends Message>(_: (_: Partial<M>) => boolean) => Promise<M>;
  ready: () => Promise<void>;
}