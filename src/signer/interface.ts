import type { Address } from 'viem';

export interface StateUpdateListener {
  onAccountsUpdate: (_: Address[]) => void;
  onChainUpdate: (_: number) => void;
}
