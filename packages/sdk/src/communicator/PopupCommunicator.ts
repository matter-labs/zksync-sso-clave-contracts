import { standardErrors } from "../errors/index.js";
import type { Communicator, Message } from "./index.js";

export interface PopupConfigMessage extends Message {
  event: "PopupLoaded" | "PopupUnload";
}

export class PopupCommunicator implements Communicator {
  private readonly url: URL;
  private popup: Window | null = null;
  private listeners = new Map<(_: MessageEvent) => void, { reject: (_: Error) => void }>();

  constructor(url: string) {
    this.url = new URL(url);
  }

  postMessage = async (message: Message) => {
    const popup = await this.waitForPopupLoaded();
    popup.postMessage(message, this.url.origin);
  };

  postRequestAndWaitForResponse = async <M extends Message>(
    request: Message & { id: NonNullable<Message["id"]> },
  ): Promise<M> => {
    const responsePromise = this.onMessage<M>(({ requestId }) => requestId === request.id);
    this.postMessage(request);
    return await responsePromise;
  };

  onMessage = async <M extends Message>(predicate: (_: Partial<M>) => boolean): Promise<M> => {
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent<M>) => {
        if (event.origin !== this.url.origin) return; // origin validation

        const message = event.data;
        if (predicate(message)) {
          resolve(message);
          window.removeEventListener("message", listener);
          this.listeners.delete(listener);
        }
      };

      window.addEventListener("message", listener);
      this.listeners.set(listener, { reject });
    });
  };

  private disconnect = () => {
    // Note: Auth Server popup handles closing itself. this is a fallback.
    try {
      if (this.popup && !this.popup.closed) {
        this.popup.close();
      }
    } catch (error) {
      console.warn("Failed to close popup", error);
    }
    this.popup = null;

    this.listeners.forEach(({ reject }, listener) => {
      reject(standardErrors.provider.userRejectedRequest("Request rejected"));
      window.removeEventListener("message", listener);
    });
    this.listeners.clear();
  };

  openPopup = () => {
    const width = 420;
    const height = 600;

    const url = new URL(this.url.toString());
    url.searchParams.set("origin", window.location.origin);

    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;

    const popup = window.open(
      url,
      "ZKsync SSO",
      `width=${width}, height=${height}, left=${left}, top=${top}`,
    );
    if (!popup) {
      throw standardErrors.rpc.internal("Pop up window failed to open");
    }
    popup.focus();
    return popup;
  };

  waitForPopupLoaded = async (): Promise<Window> => {
    if (this.popup && !this.popup.closed) {
      // Focus the popup if it's already open
      this.popup.focus();
      return this.popup;
    }

    this.popup = this.openPopup();

    this.onMessage<PopupConfigMessage>(({ event }) => event === "PopupUnload")
      .then(this.disconnect)
      .catch(() => {});

    return this.onMessage<PopupConfigMessage>(({ event }) => event === "PopupLoaded")
      .then(() => {
        if (!this.popup) throw standardErrors.rpc.internal();
        return this.popup;
      });
  };

  ready = async () => {
    await this.waitForPopupLoaded();
  };
}
