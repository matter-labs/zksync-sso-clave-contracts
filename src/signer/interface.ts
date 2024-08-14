import type { AddressString, Chain } from '../core/type/index.js';

export interface StateUpdateListener {
  onAccountsUpdate: (_: AddressString[]) => void;
  onChainUpdate: (_: Chain) => void;
}
