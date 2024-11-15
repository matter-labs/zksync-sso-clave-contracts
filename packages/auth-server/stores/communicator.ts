import type { Message, PopupConfigMessage } from "zksync-sso/communicator";

/**
* Communicates within a popup window to receive and respond to messages.
*
* This class is responsible for listening to messages from the opener,
* processing them, and sending back responses.
*
* It also handles cleanup of event listeners when necessary.
*/
export const useCommunicatorStore = defineStore("communicator", () => {
  const listeners = new Map<(_: MessageEvent) => boolean, { reject: (_: Error) => void }>();
  // const openerOrigin: string;
  // const origin = useStorage<string>("origin", "", sessionStorage);
  const { appOrigin: origin } = useAppMeta();

  /**
   * Handles incoming messages and routes them to the appropriate listeners.
   */
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== origin.value) return;

    listeners.forEach((_, listener) => {
      if (listener(event)) {
        window.removeEventListener("message", listener);
        listeners.delete(listener);
      }
    });
  };

  /**
   * Posts a message back to the opener window
   */
  const postMessage = <M extends Message>(message: M) => {
    if (!window.opener) throw new Error("No opener window found");
    window.opener.postMessage(message, origin.value);
  };

  /**
   * Waits for a specific message from the opener window
   */
  const onMessage = async <M extends Message>(predicate: (_: Partial<M>) => boolean): Promise<M> => {
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
      listeners.set(listener, { reject });
    });
  };

  /**
   * Closes the popup and clears the listeners
   */
  const disconnect = () => {
    listeners.forEach(({ reject }, listener) => {
      window.removeEventListener("message", listener);
      reject(new Error("Request rejected"));
    });
    listeners.clear();
    window.close();
  };

  /**
   * Initializes the communicator and sends a version message
   */
  const init = () => {
    window.addEventListener("message", messageHandler);

    postMessage<PopupConfigMessage>({
      event: "PopupLoaded",
      id: crypto.randomUUID(),
    });

    onMessage<PopupConfigMessage>(({ event }) => event === "PopupUnload")
      .then(disconnect)
      .catch(() => {});

    window.addEventListener("beforeunload", () => {
      postMessage<PopupConfigMessage>({
        event: "PopupUnload",
        id: crypto.randomUUID(),
      });
    });
  };

  return {
    origin,
    init,
    disconnect,
    onMessage,
    postMessage,
  };
});
