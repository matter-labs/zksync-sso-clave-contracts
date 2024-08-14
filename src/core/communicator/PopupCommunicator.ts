import { LIB_VERSION } from '../../version.js';
import type { ConfigMessage, Message, MessageID } from '../message/index.js';
import { standardErrors } from '../error/index.js';
import { closePopup, openPopup } from '../../util/web.js';
import type { Communicator } from './index.js';

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
    console.log('Post message', message);
  };

  postRequestAndWaitForResponse = async <M extends Message>(
    request: Message & { id: MessageID }
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
          console.log('Receive message', message);
          resolve(message);
          window.removeEventListener('message', listener);
          this.listeners.delete(listener);
        }
      };

      window.addEventListener('message', listener);
      this.listeners.set(listener, { reject });
    });
  };

  private disconnect = () => {
    // Note: gateway popup handles closing itself. this is a fallback.
    closePopup(this.popup);
    this.popup = null;

    this.listeners.forEach(({ reject }, listener) => {
      reject(standardErrors.provider.userRejectedRequest('Request rejected'));
      window.removeEventListener('message', listener);
    });
    this.listeners.clear();
  };

  /**
   * Waits for the popup window to fully load and then send a version message.
   */
  waitForPopupLoaded = async (): Promise<Window> => {
    if (this.popup && !this.popup.closed) {
      // In case the user un-focused the popup between requests, focus it again
      this.popup.focus();
      return this.popup;
    }

    const url = new URL(this.url.toString());
    url.searchParams.set('origin', window.location.origin);
    this.popup = openPopup(url);

    this.onMessage<ConfigMessage>(({ event }) => event === 'PopupUnload')
      .then(this.disconnect)
      .catch(() => {});

    return this.onMessage<ConfigMessage>(({ event }) => event === 'PopupLoaded')
      .then((message) => {
        this.postMessage({
          requestId: message.id,
          data: { version: LIB_VERSION },
        });
      })
      .then(() => {
        if (!this.popup) throw standardErrors.rpc.internal();
        return this.popup;
      });
  };

  ready = async () => {
    await this.waitForPopupLoaded();
  }
}
