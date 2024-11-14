import type { Message, PopupConfigMessage } from "zksync-sso/communicator";

/**
 * Communicates within a popup window to receive and respond to messages.
 *
 * This class is responsible for listening to messages from the opener,
 * processing them, and sending back responses.
 *
 * It also handles cleanup of event listeners when necessary.
 */
class PopupCommunicator {
  private listeners = new Map<(_: MessageEvent) => boolean, { reject: (_: Error) => void }>();
  private openerOrigin: string | null = null;

  /**
   * Handles incoming messages and routes them to the appropriate listeners.
   */
  private messageHandler = (event: MessageEvent) => {
    if (event.origin !== this.openerOrigin) return;

    this.listeners.forEach((_, listener) => {
      if (listener(event)) {
        window.removeEventListener("message", listener);
        this.listeners.delete(listener);
      }
    });
  };

  /**
   * Posts a message back to the opener window
   */
  postMessage = <M extends Message>(message: M) => {
    if (!window.opener) throw new Error("No opener window found");
    window.opener.postMessage(message, this.openerOrigin);
  };

  /**
   * Waits for a specific message from the opener window
   */
  onMessage = async <M extends Message>(predicate: (_: Partial<M>) => boolean): Promise<M> => {
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        const message = event.data as M;
        if (predicate(message)) {
          resolve(message);
          return true;
        }
        return false;
      };

      window.addEventListener("message", listener);
      this.listeners.set(listener, { reject });
    });
  };

  /**
   * Closes the popup and clears the listeners
   */
  disconnect = () => {
    this.listeners.forEach(({ reject }, listener) => {
      window.removeEventListener("message", listener);
      reject(new Error("Request rejected"));
    });
    this.listeners.clear();
    window.close();
  };

  /**
   * Initializes the communicator and sends a version message
   */
  init = () => {
    const origin = (new URLSearchParams(window.location.search)).get("origin");
    if (!origin) throw new Error("Origin not defined in query params");
    this.openerOrigin = origin;
    window.addEventListener("message", this.messageHandler);

    this.postMessage<PopupConfigMessage>({
      event: "PopupLoaded",
      id: crypto.randomUUID(),
    });

    this.onMessage<PopupConfigMessage>(({ event }) => event === "PopupUnload")
      .then(this.disconnect)
      .catch(() => {});

    window.addEventListener("beforeunload", () => {
      this.postMessage<PopupConfigMessage>({
        event: "PopupUnload",
        id: crypto.randomUUID(),
      });
    });
  };
}
const communicator = new PopupCommunicator();
export { communicator };
