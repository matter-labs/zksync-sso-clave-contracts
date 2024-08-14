import type { Message } from './Message.js';

export interface ConfigMessage extends Message {
  event: 'PopupLoaded' | 'PopupUnload';
}
